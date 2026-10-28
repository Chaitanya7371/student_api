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

import * as accessRepository from '../src/modules/access/access.repository.js';
import * as markRepository from '../src/modules/mark/mark.repository.js';
import * as studentRepository from '../src/modules/student/student.repository.js';
import * as userRepository from '../src/modules/user/user.repository.js';
import app from '../src/app.js';
import { account, as } from './helpers/authTest.js';

const guardian = {
  name: 'Parent',
  phone: '+919876543210',
  relation: 'father' as const,
};

const priyaStudent = {
  id: 17,
  rollNo: '2026-10A-017',
  firstName: 'Priya',
  lastName: 'Nair',
  dateOfBirth: new Date('2012-04-15T00:00:00.000Z'),
  className: '10',
  section: 'A',
  guardian,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const arjunStudent = {
  ...priyaStudent,
  id: 23,
  rollNo: '2026-09C-023',
  firstName: 'Arjun',
  lastName: 'Iyer',
  className: '9',
  section: 'C',
};

const roles = {
  admin: account(1, 'admin'),
  rao: account(2, 'teacher'),
  iyer: account(3, 'teacher'),
  priya: account(4, 'student', 17),
  arjun: account(5, 'student', 23),
};

const tokens = {
  admin: as(1, 'admin'),
  rao: as(2, 'teacher'),
  iyer: as(3, 'teacher'),
  priya: as(4, 'student'),
  arjun: as(5, 'student'),
};

let server: Server;
let baseUrl = '';

async function request(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
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
  vi.mocked(userRepository.findAuthById).mockImplementation(async (id) => {
    const found = Object.values(roles).find((row) => row.id === id);
    return found;
  });
  vi.mocked(accessRepository.findClassesForTeacher).mockImplementation(async (teacherUserId) => {
    if (teacherUserId === 2) {
      return [
        { teacherUserId: 2, className: '10', section: 'A' },
        { teacherUserId: 2, className: '10', section: 'B' },
      ];
    }
    if (teacherUserId === 3) {
      return [{ teacherUserId: 3, className: '9', section: 'C' }];
    }
    return [];
  });
  vi.mocked(studentRepository.findById).mockImplementation(async (id) => {
    if (id === 17) return priyaStudent;
    if (id === 23) return arjunStudent;
    return undefined;
  });
  vi.mocked(studentRepository.findMany).mockResolvedValue([priyaStudent, arjunStudent]);
  vi.mocked(markRepository.findById).mockResolvedValue({
    id: 50,
    studentId: 17,
    exam: 'final',
    subject: 'maths',
    score: 80,
    maxScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  vi.mocked(markRepository.subjectAverages).mockResolvedValue([
    { subject: 'maths', averagePercentage: 70, students: 2 },
  ]);
  vi.mocked(markRepository.insertMany).mockResolvedValue([]);
  vi.mocked(markRepository.update).mockResolvedValue({
    id: 50,
    studentId: 17,
    exam: 'final',
    subject: 'maths',
    score: 85,
    maxScore: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  vi.mocked(studentRepository.insert).mockResolvedValue(priyaStudent);
  vi.mocked(studentRepository.update).mockResolvedValue(priyaStudent);
  vi.mocked(studentRepository.remove).mockResolvedValue(true);
});

describe('role x endpoint matrix', () => {
  it.each([
    ['admin', 'GET', '/api/students', 200],
    ['rao', 'GET', '/api/students', 200],
    ['priya', 'GET', '/api/students', 200],
    ['admin', 'GET', '/api/students/17', 200],
    ['rao', 'GET', '/api/students/17', 200],
    ['priya', 'GET', '/api/students/17', 200],
    ['admin', 'POST', '/api/students', 201],
    ['rao', 'POST', '/api/students', 403],
    ['priya', 'POST', '/api/students', 403],
    ['admin', 'PATCH', '/api/students/17', 200],
    ['rao', 'PATCH', '/api/students/17', 403],
    ['priya', 'PATCH', '/api/students/17', 403],
    ['admin', 'DELETE', '/api/students/17', 204],
    ['rao', 'DELETE', '/api/students/17', 403],
    ['priya', 'DELETE', '/api/students/17', 403],
    ['admin', 'POST', '/api/students/17/marks', 201],
    ['rao', 'POST', '/api/students/17/marks', 201],
    ['priya', 'POST', '/api/students/17/marks', 403],
    ['admin', 'PATCH', '/api/marks/50', 200],
    ['rao', 'PATCH', '/api/marks/50', 200],
    ['priya', 'PATCH', '/api/marks/50', 403],
    ['admin', 'GET', '/api/marks/averages?className=10', 200],
    ['rao', 'GET', '/api/marks/averages?className=10', 200],
    ['priya', 'GET', '/api/marks/averages?className=10', 403],
  ] as const)('%s %s %s -> %i', async (who, method, path, status) => {
    const bodies: Record<string, unknown> = {
      'POST /api/students': {
        rollNo: '2026-10A-099',
        firstName: 'New',
        lastName: 'Student',
        dateOfBirth: '2012-04-15',
        className: '10',
        section: 'A',
        guardian,
      },
      'PATCH /api/students/17': { firstName: 'Priya' },
      'POST /api/students/17/marks': { exam: 'final', marks: [{ subject: 'maths', score: 80, maxScore: 100 }] },
      'PATCH /api/marks/50': { score: 85 },
    };
    const key = `${method} ${path.split('?')[0]}`;
    const result = await request(tokens[who], method, path, bodies[key]);
    expect(result.status).toBe(status);
  });
});

describe('IDOR and list filtering', () => {
  it('blocks Ms Rao from reading student 23 (class 9C)', async () => {
    const result = await request(tokens.rao, 'GET', '/api/students/23');
    expect(result.status).toBe(403);
  });

  it('blocks Ms Rao from posting marks for student 23 and never calls the write', async () => {
    const result = await request(tokens.rao, 'POST', '/api/students/23/marks', {
      exam: 'final',
      marks: [{ subject: 'maths', score: 80, maxScore: 100 }],
    });
    expect(result.status).toBe(403);
    expect(markRepository.insertMany).not.toHaveBeenCalled();
  });

  it('returns 403 when a teacher asks for averages outside their classes', async () => {
    const result = await request(tokens.rao, 'GET', '/api/marks/averages?className=9');
    expect(result.status).toBe(403);
  });

  it('lets Priya list only herself', async () => {
    const result = await request(tokens.priya, 'GET', '/api/students');
    expect(result.status).toBe(200);
    const rows = (result.body as { data: { id: number }[] }).data;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(17);
  });
});
