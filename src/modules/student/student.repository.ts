import { pool, table } from '../../config/db.js';
import { conflict } from '../../errors/AppError.js';
import { isUniqueViolation } from '../../errors/dbError.js';
import { escapeLike } from '../../utils/validators.js';
import type {
  Student,
  StudentChanges,
  StudentRow,
  StudentWritableColumns,
} from './student.interface.js';

const students = () => table('students');
const relations = ['father', 'mother', 'guardian'] as const;

function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Database row -> domain Student. Rows never leave this file. */
export function toDomain(row: StudentRow): Student {
  if (!relations.includes(row.guardian_relation as (typeof relations)[number])) {
    throw new Error(`Unknown guardian_relation: ${row.guardian_relation}`);
  }

  return {
    id: row.id,
    rollNo: row.roll_no,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    className: row.class_name,
    section: row.section,
    guardian: {
      name: row.guardian_name,
      phone: row.guardian_phone,
      relation: row.guardian_relation as Student['guardian']['relation'],
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Domain changes -> flat columns. Only fields that were sent are included. */
export function toPersistence(changes: StudentChanges): StudentWritableColumns {
  const columns: StudentWritableColumns = {};
  if (changes.rollNo !== undefined) columns.roll_no = changes.rollNo;
  if (changes.firstName !== undefined) columns.first_name = changes.firstName;
  if (changes.lastName !== undefined) columns.last_name = changes.lastName;
  if (changes.dateOfBirth !== undefined) columns.date_of_birth = formatDateOnly(changes.dateOfBirth);
  if (changes.className !== undefined) columns.class_name = changes.className;
  if (changes.section !== undefined) columns.section = changes.section;
  if (changes.guardian !== undefined) {
    columns.guardian_name = changes.guardian.name;
    columns.guardian_phone = changes.guardian.phone;
    columns.guardian_relation = changes.guardian.relation;
  }
  return columns;
}

export interface StudentFilter {
  className?: string;
  section?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const findMany = async (filter: StudentFilter): Promise<Student[]> => {
  const search = filter.search ? `%${escapeLike(filter.search)}%` : null;
  const result = await pool.query<StudentRow>(
    `SELECT id, roll_no, first_name, last_name, date_of_birth, class_name, section,
            guardian_name, guardian_phone, guardian_relation, created_at, updated_at
     FROM ${students()}
     WHERE ($1::text IS NULL OR class_name = $1)
       AND ($2::text IS NULL OR section = $2)
       AND (
         $3::text IS NULL
         OR first_name ILIKE $3 ESCAPE '\\'
         OR last_name ILIKE $3 ESCAPE '\\'
       )
     ORDER BY id
     LIMIT $4 OFFSET $5`,
    [filter.className ?? null, filter.section ?? null, search, filter.limit ?? 20, filter.offset ?? 0],
  );
  return result.rows.map(toDomain);
};

export const findById = async (id: number): Promise<Student | undefined> => {
  const result = await pool.query<StudentRow>(
    `SELECT id, roll_no, first_name, last_name, date_of_birth, class_name, section,
            guardian_name, guardian_phone, guardian_relation, created_at, updated_at
     FROM ${students()} WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? toDomain(row) : undefined;
};

export const insert = async (changes: StudentChanges): Promise<Student> => {
  const columns = toPersistence(changes);
  try {
    const result = await pool.query<StudentRow>(
      `INSERT INTO ${students()} (
         roll_no, first_name, last_name, date_of_birth, class_name, section,
         guardian_name, guardian_phone, guardian_relation
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, roll_no, first_name, last_name, date_of_birth, class_name, section,
                 guardian_name, guardian_phone, guardian_relation, created_at, updated_at`,
      [
        columns.roll_no,
        columns.first_name,
        columns.last_name,
        columns.date_of_birth,
        columns.class_name,
        columns.section,
        columns.guardian_name,
        columns.guardian_phone,
        columns.guardian_relation,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Insert student returned no row');
    return toDomain(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('A student with that roll number already exists');
    throw error;
  }
};

const writableKeys = [
  'roll_no',
  'first_name',
  'last_name',
  'date_of_birth',
  'class_name',
  'section',
  'guardian_name',
  'guardian_phone',
  'guardian_relation',
] as const;

export const update = async (id: number, changes: StudentChanges): Promise<Student | undefined> => {
  const columns = toPersistence(changes);
  const values: unknown[] = [];
  const sets: string[] = [];

  for (const key of writableKeys) {
    if (columns[key] !== undefined) {
      values.push(columns[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }

  if (sets.length === 0) return findById(id);

  values.push(id);
  try {
    const result = await pool.query<StudentRow>(
      `UPDATE ${students()}
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, roll_no, first_name, last_name, date_of_birth, class_name, section,
                 guardian_name, guardian_phone, guardian_relation, created_at, updated_at`,
      values,
    );
    const row = result.rows[0];
    return row ? toDomain(row) : undefined;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('A student with that roll number already exists');
    throw error;
  }
};

export const remove = async (id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM ${students()} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
};
