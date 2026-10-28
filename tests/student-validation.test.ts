import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/modules/student/student.repository.js', () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  toDomain: vi.fn(),
  toPersistence: vi.fn(),
}));

vi.mock('../src/modules/mark/mark.repository.js', () => ({
  findById: vi.fn(),
  insertMany: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  subjectAverages: vi.fn(),
  toDomain: vi.fn(),
  toPersistence: vi.fn(),
}));

vi.mock('../src/modules/user/user.repository.js', () => ({
  findAllUsers: vi.fn(),
  findUserById: vi.fn(),
  findAuthById: vi.fn(),
  findUserByEmail: vi.fn(),
  findAuthByEmail: vi.fn(),
  insertUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserRole: vi.fn(),
  linkStudent: vi.fn(),
  deleteUserById: vi.fn(),
}));

vi.mock('../src/modules/access/access.repository.js', () => ({
  findClassesForTeacher: vi.fn(),
  insertTeacherClass: vi.fn(),
}));

import * as markRepository from '../src/modules/mark/mark.repository.js';
import * as studentRepository from '../src/modules/student/student.repository.js';
import * as userRepository from '../src/modules/user/user.repository.js';
import app from '../src/app.js';
import { account, as } from './helpers/authTest.js';

const guardian = { name: 'Ravi Sharma', phone: '+919876543210', relation: 'father' as const };
const adminToken = as(1, 'admin');

function studentBody(overrides: Record<string, unknown> = {}) {
  return {
    rollNo: '2026-10A-017',
    firstName: 'Asha',
    lastName: 'Sharma',
    dateOfBirth: '2012-04-15',
    className: '10',
    section: 'A',
    guardian,
    ...overrides,
  };
}

let server: Server;
let baseUrl = '';

async function send(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${adminToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? (JSON.parse(text) as { error?: { details?: unknown } }) : {};
  return { status: response.status, details: JSON.stringify(json.error?.details ?? {}) };
}

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userRepository.findAuthById).mockResolvedValue(account(1, 'admin'));
  vi.mocked(studentRepository.insert).mockImplementation(async (changes) => ({
    id: 1,
    rollNo: changes.rollNo ?? '',
    firstName: changes.firstName ?? '',
    lastName: changes.lastName ?? '',
    dateOfBirth: changes.dateOfBirth ?? new Date('2012-04-15T00:00:00.000Z'),
    className: changes.className ?? '',
    section: changes.section ?? '',
    guardian: changes.guardian ?? guardian,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  }));
});

describe('malicious student and mark payloads', () => {
  it('rejects SQL injection in rollNo', async () => {
    // A quote in the roll number would change the SQL statement if it were concatenated.
    const result = await send('POST', '/api/students', studentBody({ rollNo: "2026-10A-017' OR '1'='1" }));
    expect(result.status).toBe(400);
    expect(result.details).toContain('rollNo');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects stored XSS in a top-level name', async () => {
    // The script would run in a browser the next time a teacher opened the student.
    const result = await send('POST', '/api/students', studentBody({ firstName: '<script>alert(1)</script>' }));
    expect(result.status).toBe(400);
    expect(result.details).toContain('firstName');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects XSS hidden inside the nested guardian', async () => {
    // The tag would be stored on the guardian and run when that nested object is rendered.
    const result = await send(
      'POST',
      '/api/students',
      studentBody({ guardian: { name: '<img src=x onerror=alert(1)>', phone: '+919876543210', relation: 'father' } }),
    );
    expect(result.status).toBe(400);
    expect(result.details).toContain('guardian.name');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects prototype pollution', async () => {
    // __proto__ would add properties onto every object in the process.
    const raw = JSON.stringify(studentBody()).replace(/}$/, ',"__proto__":{"admin":true}}');
    const response = await fetch(`${baseUrl}/api/students`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
      body: raw,
    });
    const text = await response.text();
    const json = text ? (JSON.parse(text) as { error?: { details?: unknown } }) : {};
    const result = { status: response.status, details: JSON.stringify(json.error?.details ?? {}) };
    expect(result.status).toBe(400);
    expect(result.details).toContain('__proto__');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects mass assignment of id', async () => {
    // A caller could choose their own id or overwrite createdAt.
    const result = await send('POST', '/api/students', studentBody({ id: 1 }));
    expect(result.status).toBe(400);
    expect(result.details).toContain('id');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects a type confusion where a name is an object', async () => {
    // An object in a string field can crash code that calls string methods.
    const result = await send('POST', '/api/students', studentBody({ firstName: { bad: true } }));
    expect(result.status).toBe(400);
    expect(result.details).toContain('firstName');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects an oversized marks array', async () => {
    // A thousand rows would be written in one request and lock the marks table.
    const marks = Array.from({ length: 1000 }, (_item, index) => ({
      subject: `subject-${index}`,
      score: 1,
      maxScore: 100,
    }));
    const result = await send('POST', '/api/students/1/marks', { exam: 'final', marks });
    expect(result.status).toBe(400);
    expect(result.details).toContain('marks');
    expect(markRepository.insertMany).not.toHaveBeenCalled();
  });

  it('rejects a score higher than maxScore inside the marks array', async () => {
    // The student would be recorded as scoring more than the paper is worth.
    const result = await send('POST', '/api/students/1/marks', {
      exam: 'final',
      marks: [{ subject: 'maths', score: 120, maxScore: 100 }],
    });
    expect(result.status).toBe(400);
    expect(result.details).toContain('marks.0.score');
    expect(markRepository.insertMany).not.toHaveBeenCalled();
  });

  it('rejects a null byte in a name', async () => {
    // A null byte can hide the rest of a string from a C library or a log file.
    const result = await send('POST', '/api/students', studentBody({ lastName: 'Sharma\u0000admin' }));
    expect(result.status).toBe(400);
    expect(result.details).toContain('lastName');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects an impossible date that looks like a date', async () => {
    // 30 February is not a day, so it must not be stored as a birthday.
    const result = await send('POST', '/api/students', studentBody({ dateOfBirth: '2026-02-30' }));
    expect(result.status).toBe(400);
    expect(result.details).toContain('dateOfBirth');
    expect(studentRepository.insert).not.toHaveBeenCalled();
  });
});

describe('sanitised student input', () => {
  it('cleans roll number, phone, relation, and class before the repository sees them', async () => {
    const result = await send(
      'POST',
      '/api/students',
      studentBody({
        rollNo: '  2026-10a-017 ',
        className: 7,
        guardian: { name: 'Ravi Sharma', phone: '+91 98765-43210', relation: 'Mother' },
      }),
    );

    expect(result.status).toBe(201);
    expect(studentRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        rollNo: '2026-10A-017',
        className: '7',
        guardian: { name: 'Ravi Sharma', phone: '+919876543210', relation: 'mother' },
      }),
    );
  });
});
