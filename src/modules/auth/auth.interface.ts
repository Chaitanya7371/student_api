import type { Role } from '../../config/permissions.js';

/** Who is making the request. Built by authenticate from the database, not from the JWT alone. */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  studentId: number | null;
}

export interface AuthAccount {
  id: number;
  email: string;
  name: string;
  role: Role;
  studentId: number | null;
  passwordHash: string;
  createdAt: Date;
}
