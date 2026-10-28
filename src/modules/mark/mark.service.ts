import { env } from '../../config/env.js';
import { hasPermission } from '../../config/permissions.js';
import { badRequest, forbidden, notFound } from '../../errors/AppError.js';
import * as accessRepository from '../access/access.repository.js';
import { canAccessStudent } from '../access/canAccessStudent.js';
import type { AuthUser } from '../auth/auth.interface.js';
import * as studentRepository from '../student/student.repository.js';
import type { AveragesQueryDto, CreateMarksDto, MarkResponseDto, SubjectAverageResponseDto, UpdateMarkDto } from './mark.dto.js';
import type { Mark, SubjectAverage } from './mark.interface.js';
import * as markRepository from './mark.repository.js';

export function toResponseDto(mark: Mark): MarkResponseDto {
  return {
    id: mark.id,
    studentId: mark.studentId,
    exam: mark.exam,
    subject: mark.subject,
    score: mark.score,
    maxScore: mark.maxScore,
    createdAt: mark.createdAt.toISOString(),
    updatedAt: mark.updatedAt.toISOString(),
  };
}

function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Service decides pass/fail from PASS_PERCENTAGE. The SQL only returns the average. */
export function toAverageResponse(average: SubjectAverage): SubjectAverageResponseDto {
  const averagePercentage = roundToTwo(average.averagePercentage);
  return {
    subject: average.subject,
    averagePercentage,
    students: average.students,
    passed: averagePercentage >= env.PASS_PERCENTAGE,
  };
}

export const addMarks = async (actor: AuthUser, studentId: number, dto: CreateMarksDto): Promise<MarkResponseDto[]> => {
  const student = await studentRepository.findById(studentId);
  if (!student) throw notFound(`Student ${studentId} not found`);
  if (!(await canAccessStudent(actor, student, 'write'))) {
    throw forbidden('You cannot access this student');
  }

  const saved = await markRepository.insertMany(studentId, dto.exam, dto.marks);
  return saved.map(toResponseDto);
};

export const updateMark = async (actor: AuthUser, id: number, dto: UpdateMarkDto): Promise<MarkResponseDto> => {
  const current = await markRepository.findById(id);
  if (!current) throw notFound(`Mark ${id} not found`);

  const student = await studentRepository.findById(current.studentId);
  if (!student) throw notFound(`Student ${current.studentId} not found`);
  if (!(await canAccessStudent(actor, student, 'write'))) {
    throw forbidden('You cannot access this student');
  }

  const score = dto.score ?? current.score;
  const maxScore = dto.maxScore ?? current.maxScore;
  if (score > maxScore) {
    throw badRequest('score must be less than or equal to maxScore', {
      fieldErrors: { score: ['score must be less than or equal to maxScore'] },
    });
  }

  const updated = await markRepository.update(id, { score: dto.score, maxScore: dto.maxScore });
  if (!updated) throw notFound(`Mark ${id} not found`);
  return toResponseDto(updated);
};

export const deleteMark = async (actor: AuthUser, id: number): Promise<void> => {
  const current = await markRepository.findById(id);
  if (!current) throw notFound(`Mark ${id} not found`);

  const student = await studentRepository.findById(current.studentId);
  if (!student) throw notFound(`Student ${current.studentId} not found`);
  if (!(await canAccessStudent(actor, student, 'write'))) {
    throw forbidden('You cannot access this student');
  }

  const deleted = await markRepository.remove(id);
  if (!deleted) throw notFound(`Mark ${id} not found`);
};

export const averageMarks = async (actor: AuthUser, query: AveragesQueryDto): Promise<SubjectAverageResponseDto[]> => {
  if (hasPermission(actor.role, 'marks:averages:any')) {
    const rows = await markRepository.subjectAverages(query);
    return rows.map(toAverageResponse);
  }

  if (!hasPermission(actor.role, 'marks:averages:class')) {
    throw forbidden('You do not have permission for this action');
  }

  const classes = await accessRepository.findClassesForTeacher(actor.id);
  const matching = classes.filter((item) => {
    if (item.className !== query.className) return false;
    if (query.section !== undefined && item.section !== query.section) return false;
    return true;
  });

  if (matching.length === 0) {
    throw forbidden('You cannot view averages for that class');
  }

  // When section is omitted, run one query per taught section and merge by subject.
  if (query.section !== undefined) {
    const rows = await markRepository.subjectAverages(query);
    return rows.map(toAverageResponse);
  }

  const combined = new Map<string, { total: number; students: number }>();
  for (const item of matching) {
    const rows = await markRepository.subjectAverages({
      className: query.className,
      exam: query.exam,
      section: item.section,
    });
    for (const row of rows) {
      const existing = combined.get(row.subject) ?? { total: 0, students: 0 };
      existing.total += row.averagePercentage * row.students;
      existing.students += row.students;
      combined.set(row.subject, existing);
    }
  }

  return [...combined.entries()]
    .map(([subject, value]) =>
      toAverageResponse({
        subject,
        averagePercentage: value.students === 0 ? 0 : value.total / value.students,
        students: value.students,
      }),
    )
    .sort((left, right) => left.subject.localeCompare(right.subject));
};
