import { pool, table } from '../../config/db.js';
import type { Role } from '../../config/permissions.js';
import type { AuthAccountRow, User } from './user.interface.js';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  student_id: number | null;
  created_at: Date;
}

interface AuthRow extends UserRow {
  password_hash: string | null;
}

const users = () => table('users');

const mapUser = (row: UserRow): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role as Role,
  studentId: row.student_id,
  createdAt: row.created_at,
});

const mapAuth = (row: AuthRow): AuthAccountRow | undefined => {
  if (!row.password_hash) return undefined;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    studentId: row.student_id,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
};

const publicColumns = `id, name, email, role, student_id, created_at`;
const authColumns = `${publicColumns}, password_hash`;

export const findAllUsers = async (): Promise<User[]> => {
  const result = await pool.query<UserRow>(`SELECT ${publicColumns} FROM ${users()} ORDER BY id`);
  return result.rows.map(mapUser);
};

export const findUserById = async (id: number): Promise<User | undefined> => {
  const result = await pool.query<UserRow>(`SELECT ${publicColumns} FROM ${users()} WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapUser(row) : undefined;
};

export const findAuthById = async (id: number): Promise<AuthAccountRow | undefined> => {
  const result = await pool.query<AuthRow>(`SELECT ${authColumns} FROM ${users()} WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? mapAuth(row) : undefined;
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  const result = await pool.query<UserRow>(`SELECT ${publicColumns} FROM ${users()} WHERE email = $1`, [email]);
  const row = result.rows[0];
  return row ? mapUser(row) : undefined;
};

export const findAuthByEmail = async (email: string): Promise<AuthAccountRow | undefined> => {
  const result = await pool.query<AuthRow>(`SELECT ${authColumns} FROM ${users()} WHERE email = $1`, [email]);
  const row = result.rows[0];
  return row ? mapAuth(row) : undefined;
};

export const insertUser = async (name: string, email: string, passwordHash?: string, role: Role = 'user'): Promise<User> => {
  const result = await pool.query<UserRow>(
    `INSERT INTO ${users()} (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${publicColumns}`,
    [name, email, passwordHash ?? null, role],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert user returned no row');
  return mapUser(row);
};

export const updateUser = async (id: number, name: string, email: string): Promise<User | undefined> => {
  const result = await pool.query<UserRow>(
    `UPDATE ${users()} SET name = $2, email = $3 WHERE id = $1 RETURNING ${publicColumns}`,
    [id, name, email],
  );
  const row = result.rows[0];
  return row ? mapUser(row) : undefined;
};

export const updateUserRole = async (id: number, role: Role): Promise<User | undefined> => {
  const result = await pool.query<UserRow>(
    `UPDATE ${users()} SET role = $2 WHERE id = $1 RETURNING ${publicColumns}`,
    [id, role],
  );
  const row = result.rows[0];
  return row ? mapUser(row) : undefined;
};

export const linkStudent = async (userId: number, studentId: number): Promise<User | undefined> => {
  const result = await pool.query<UserRow>(
    `UPDATE ${users()} SET student_id = $2 WHERE id = $1 RETURNING ${publicColumns}`,
    [userId, studentId],
  );
  const row = result.rows[0];
  return row ? mapUser(row) : undefined;
};

export const deleteUserById = async (id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM ${users()} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
};
