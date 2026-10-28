import type { Role } from '../../config/permissions.js';

/** Public-facing user shape (no password). */
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  studentId: number | null;
  createdAt: Date;
}

/** Full account row used by login and authenticate. */
export interface AuthAccountRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  studentId: number | null;
  passwordHash: string;
  createdAt: Date;
}
