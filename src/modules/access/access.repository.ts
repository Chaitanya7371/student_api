import { pool, table } from '../../config/db.js';

export interface TeacherClass {
  teacherUserId: number;
  className: string;
  section: string;
}

interface TeacherClassRow {
  teacher_user_id: number;
  class_name: string;
  section: string;
}

const teacherClasses = () => table('teacher_classes');

export const findClassesForTeacher = async (teacherUserId: number): Promise<TeacherClass[]> => {
  const result = await pool.query<TeacherClassRow>(
    `SELECT teacher_user_id, class_name, section
     FROM ${teacherClasses()}
     WHERE teacher_user_id = $1
     ORDER BY class_name, section`,
    [teacherUserId],
  );
  return result.rows.map((row) => ({
    teacherUserId: row.teacher_user_id,
    className: row.class_name,
    section: row.section.trim(),
  }));
};

export const insertTeacherClass = async (
  teacherUserId: number,
  className: string,
  section: string,
): Promise<TeacherClass> => {
  const result = await pool.query<TeacherClassRow>(
    `INSERT INTO ${teacherClasses()} (teacher_user_id, class_name, section)
     VALUES ($1, $2, $3)
     RETURNING teacher_user_id, class_name, section`,
    [teacherUserId, className, section],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert teacher class returned no row');
  return {
    teacherUserId: row.teacher_user_id,
    className: row.class_name,
    section: row.section.trim(),
  };
};
