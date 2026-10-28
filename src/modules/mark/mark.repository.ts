import type { PoolClient } from 'pg';
import { pool, table } from '../../config/db.js';
import { conflict, notFound } from '../../errors/AppError.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../errors/dbError.js';
import type { ExamName, Mark, MarkDraft, MarkRow, MarkWritableColumns, SubjectAverage } from './mark.interface.js';

const marksTable = () => table('marks');
const studentsTable = () => table('students');
const exams = ['unit-1', 'midterm', 'unit-2', 'final'] as const;

function toNumber(value: string, column: string): number {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    throw new Error(`Invalid NUMERIC value for ${column}: ${value}`);
  }
  return numberValue;
}

/** Database row -> domain Mark. "78.50" becomes 78.5. */
export function toDomain(row: MarkRow): Mark {
  if (!exams.includes(row.exam as ExamName)) {
    throw new Error(`Unknown exam: ${row.exam}`);
  }

  return {
    id: row.id,
    studentId: row.student_id,
    exam: row.exam as ExamName,
    subject: row.subject,
    score: toNumber(row.score, 'score'),
    maxScore: toNumber(row.max_score, 'max_score'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** One mark ready to insert. */
export function toPersistence(mark: { studentId?: number; exam?: ExamName; subject?: string; score?: number; maxScore?: number }): MarkWritableColumns {
  const columns: MarkWritableColumns = {};
  if (mark.studentId !== undefined) columns.student_id = mark.studentId;
  if (mark.exam !== undefined) columns.exam = mark.exam;
  if (mark.subject !== undefined) columns.subject = mark.subject;
  if (mark.score !== undefined) columns.score = mark.score;
  if (mark.maxScore !== undefined) columns.max_score = mark.maxScore;
  return columns;
}

const returning = `id, student_id, exam, subject, score::text, max_score::text, created_at, updated_at`;

function translateWriteError(error: unknown, studentId: number): never {
  if (isForeignKeyViolation(error)) throw notFound(`Student ${studentId} not found`);
  if (isUniqueViolation(error)) throw conflict('A mark for that student, exam, and subject already exists');
  throw error;
}

export const findById = async (id: number): Promise<Mark | undefined> => {
  const result = await pool.query<MarkRow>(`SELECT ${returning} FROM ${marksTable()} WHERE id = $1`, [id]);
  const row = result.rows[0];
  return row ? toDomain(row) : undefined;
};

/** Save every mark in one transaction. If any insert fails, none are kept. */
export const insertMany = async (studentId: number, exam: ExamName, marks: MarkDraft[]): Promise<Mark[]> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const saved: Mark[] = [];

    for (const mark of marks) {
      const columns = toPersistence({ studentId, exam, subject: mark.subject, score: mark.score, maxScore: mark.maxScore });
      const result = await client.query<MarkRow>(
        `INSERT INTO ${marksTable()} (student_id, exam, subject, score, max_score)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${returning}`,
        [columns.student_id, columns.exam, columns.subject, columns.score, columns.max_score],
      );
      const row = result.rows[0];
      if (!row) throw new Error('Insert mark returned no row');
      saved.push(toDomain(row));
    }

    await client.query('COMMIT');
    return saved;
  } catch (error) {
    await client.query('ROLLBACK');
    translateWriteError(error, studentId);
  } finally {
    client.release();
  }
};

export const update = async (id: number, changes: { score?: number; maxScore?: number }): Promise<Mark | undefined> => {
  const columns = toPersistence(changes);
  const values: unknown[] = [];
  const sets: string[] = [];

  if (columns.score !== undefined) {
    values.push(columns.score);
    sets.push(`score = $${values.length}`);
  }
  if (columns.max_score !== undefined) {
    values.push(columns.max_score);
    sets.push(`max_score = $${values.length}`);
  }
  if (sets.length === 0) return findById(id);

  values.push(id);
  const result = await pool.query<MarkRow>(
    `UPDATE ${marksTable()}
     SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING ${returning}`,
    values,
  );
  const row = result.rows[0];
  return row ? toDomain(row) : undefined;
};

export const remove = async (id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM ${marksTable()} WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
};

export const subjectAverages = async (filter: {
  className: string;
  exam?: ExamName;
  section?: string;
}): Promise<SubjectAverage[]> => {
  const result = await pool.query<{ subject: string; average_percentage: number; students: number }>(
    `SELECT m.subject,
            AVG(m.score / m.max_score * 100)::float8 AS average_percentage,
            COUNT(DISTINCT m.student_id)::int AS students
     FROM ${marksTable()} m
     JOIN ${studentsTable()} s ON s.id = m.student_id
     WHERE s.class_name = $1
       AND ($2::text IS NULL OR m.exam = $2)
       AND ($3::text IS NULL OR s.section = $3)
     GROUP BY m.subject
     ORDER BY m.subject`,
    [filter.className, filter.exam ?? null, filter.section ?? null],
  );

  return result.rows.map((row) => ({
    subject: row.subject,
    averagePercentage: row.average_percentage,
    students: row.students,
  }));
};
