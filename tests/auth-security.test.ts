import type { Server } from 'node:http';
import bcrypt from 'bcrypt';
import express from 'express';
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

import { createRateLimiter } from '../src/middlewares/rateLimit.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
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

const student17 = {
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

let server: Server;
let baseUrl = '';
let currentRole: 'teacher' | 'user' = 'teacher';

async function request(token: string | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  return { status: response.status, headers: response.headers, body: parsed, text };
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
  currentRole = 'teacher';
  vi.mocked(userRepository.findAuthById).mockImplementation(async (id) => {
    if (id === 2) return account(2, currentRole);
    if (id === 1) return account(1, 'admin');
    if (id === 99) return account(99, 'user');
    return undefined;
  });
  vi.mocked(accessRepository.findClassesForTeacher).mockResolvedValue([
    { teacherUserId: 2, className: '10', section: 'A' },
  ]);
  vi.mocked(studentRepository.findById).mockResolvedValue(student17);
  vi.mocked(studentRepository.findMany).mockResolvedValue([student17]);
  vi.mocked(markRepository.insertMany).mockResolvedValue([
    {
      id: 1,
      studentId: 17,
      exam: 'final',
      subject: 'maths',
      score: 80,
      maxScore: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  vi.mocked(markRepository.subjectAverages).mockResolvedValue([]);
});

describe('Part A — roles and linking', () => {
  it('registered plain users cannot see students or marks', async () => {
    vi.mocked(userRepository.insertUser).mockResolvedValue({
      id: 99,
      name: 'Plain',
      email: 'plain@school.test',
      role: 'user',
      studentId: null,
      createdAt: new Date(),
    });

    const registered = await request(null, 'POST', '/api/auth/register', {
      name: 'Plain User',
      email: 'plain@school.test',
      password: 'password123',
    });
    expect(registered.status).toBe(201);
    const token = (registered.body as { data: { accessToken: string } }).data.accessToken;

    const students = await request(token, 'GET', '/api/students');
    expect(students.status).toBe(403);

    const averages = await request(token, 'GET', '/api/marks/averages?className=10');
    expect(averages.status).toBe(403);
  });

  it('stops teacher actions after an admin demotes the account to user', async () => {
    const token = as(2, 'teacher');
    const allowed = await request(token, 'GET', '/api/students/17');
    expect(allowed.status).toBe(200);

    currentRole = 'user';
    const denied = await request(token, 'GET', '/api/students/17');
    expect(denied.status).toBe(403);
  });

  it('rejects linking a non-teacher to a class', async () => {
    vi.mocked(userRepository.findUserById).mockResolvedValue({
      id: 99,
      name: 'Plain',
      email: 'plain@school.test',
      role: 'user',
      studentId: null,
      createdAt: new Date(),
    });
    const result = await request(as(1, 'admin'), 'POST', '/api/admin/teacher-classes', {
      teacherUserId: 99,
      className: '10',
      section: 'A',
    });
    expect(result.status).toBe(400);
  });
});

describe('Part C — API security', () => {
  it('rate-limits by user id, not IP', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyFn: (req) => `marks:${req.user?.id ?? 'anon'}`,
    });

    const mini = express();
    mini.use(express.json());
    mini.post(
      '/marks',
      (req, _res, next) => {
        const id = Number(req.headers['x-user-id']);
        req.user = {
          id,
          email: `u${id}@test`,
          name: `U${id}`,
          role: 'teacher',
          studentId: null,
        };
        next();
      },
      limiter,
      (_req, res) => {
        res.status(201).json({ data: { ok: true } });
      },
    );
    mini.use(errorHandler);

    const miniServer = mini.listen(0);
    await new Promise<void>((resolve) => miniServer.once('listening', resolve));
    const address = miniServer.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    const url = `http://127.0.0.1:${address.port}/marks`;

    const hit = async (userId: number) =>
      fetch(url, {
        method: 'POST',
        headers: { 'x-user-id': String(userId), 'content-type': 'application/json' },
        body: '{}',
      });

    expect((await hit(10)).status).toBe(201);
    expect((await hit(10)).status).toBe(201);
    expect((await hit(10)).status).toBe(429);
    // Same IP, different user — still allowed.
    expect((await hit(11)).status).toBe(201);

    await new Promise<void>((resolve, reject) => {
      miniServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('sets Cache-Control: no-store on student success and error responses', async () => {
    const token = as(2, 'teacher');
    const ok = await request(token, 'GET', '/api/students/17');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');

    vi.mocked(studentRepository.findById).mockResolvedValueOnce(undefined);
    const missing = await request(token, 'GET', '/api/students/999');
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('no-store');
  });

  it('never leaks password, password hash, or raw access token in response bodies', async () => {
    const password = 'SuperSecret1';
    const passwordHash = await bcrypt.hash(password, 4);
    vi.mocked(userRepository.findAuthByEmail).mockResolvedValue({
      id: 1,
      name: 'Admin',
      email: 'admin@school.test',
      role: 'admin',
      studentId: null,
      passwordHash,
      createdAt: new Date(),
    });
    vi.mocked(userRepository.findAuthById).mockResolvedValue(account(1, 'admin'));

    const login = await request(null, 'POST', '/api/auth/login', {
      email: 'admin@school.test',
      password,
    });
    expect(login.status).toBe(200);
    const accessToken = (login.body as { data: { accessToken: string } }).data.accessToken;

    const paths = [
      await request(accessToken, 'GET', '/api/students'),
      await request(accessToken, 'GET', '/api/students/17'),
      await request(accessToken, 'GET', '/api/marks/averages?className=10'),
    ];

    for (const result of [login, ...paths]) {
      expect(result.text).not.toContain(password);
      expect(result.text).not.toContain(passwordHash);
      // Student / marks responses (including curl) must not echo the bearer token.
      if (result !== login) {
        expect(result.text).not.toContain(accessToken);
      }
    }

    expect(JSON.stringify((login.body as { curl?: string }).curl)).toContain('[REDACTED]');
  });
});
