import type { Role } from '../../src/config/permissions.js';
import { signAccessToken } from '../../src/modules/auth/auth.service.js';
import type { AuthAccountRow } from '../../src/modules/user/user.interface.js';

/** Build a fake account row the authenticate middleware can reload from the mocked repository. */
export function account(id: number, role: Role, studentId: number | null = null): AuthAccountRow {
  return {
    id,
    name: `User ${id}`,
    email: `user${id}@school.test`,
    role,
    studentId,
    passwordHash: 'hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/** Signed access token for tests. Role still comes from the DB mock on each request. */
export function as(id: number, _role: Role): string {
  return signAccessToken(id);
}
