import { hasPermission } from '../../config/permissions.js';
import { forbidden, notFound } from '../../errors/AppError.js';
import { canAccessStudent } from '../access/canAccessStudent.js';
import type { AuthUser } from '../auth/auth.interface.js';
import type { CreateStudentDto, ListStudentsQueryDto, StudentResponseDto, UpdateStudentDto } from './student.dto.js';
import type { Student, StudentChanges } from './student.interface.js';
import * as studentRepository from './student.repository.js';

/** Dates become strings the client can read. dateOfBirth stays a calendar date. */
export function toResponseDto(student: Student): StudentResponseDto {
  return {
    id: student.id,
    rollNo: student.rollNo,
    firstName: student.firstName,
    lastName: student.lastName,
    dateOfBirth: formatDate(student.dateOfBirth),
    className: student.className,
    section: student.section,
    guardian: student.guardian,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  };
}

function formatDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toChanges(dto: CreateStudentDto | UpdateStudentDto): StudentChanges {
  const changes: StudentChanges = {};
  if (dto.rollNo !== undefined) changes.rollNo = dto.rollNo;
  if (dto.firstName !== undefined) changes.firstName = dto.firstName;
  if (dto.lastName !== undefined) changes.lastName = dto.lastName;
  if (dto.dateOfBirth !== undefined) changes.dateOfBirth = new Date(`${dto.dateOfBirth}T00:00:00.000Z`);
  if (dto.className !== undefined) changes.className = dto.className;
  if (dto.section !== undefined) changes.section = dto.section;
  if (dto.guardian !== undefined) changes.guardian = dto.guardian;
  return changes;
}

/**
 * Out-of-scope single records always use 403 (same status everywhere).
 * Lists filter instead — see findStudents.
 */
async function assertCanAccess(actor: AuthUser, student: Student, action: 'read' | 'write'): Promise<void> {
  if (!(await canAccessStudent(actor, student, action))) {
    throw forbidden('You cannot access this student');
  }
}

/** List endpoints FILTER to what the actor may see, rather than returning 403 for the whole list. */
export const findStudents = async (actor: AuthUser, query: ListStudentsQueryDto): Promise<StudentResponseDto[]> => {
  const students = await studentRepository.findMany(query);
  const visible: Student[] = [];
  for (const student of students) {
    if (await canAccessStudent(actor, student, 'read')) visible.push(student);
  }
  return visible.map(toResponseDto);
};

export const findStudent = async (actor: AuthUser, id: number): Promise<StudentResponseDto> => {
  const student = await studentRepository.findById(id);
  if (!student) throw notFound(`Student ${id} not found`);
  await assertCanAccess(actor, student, 'read');
  return toResponseDto(student);
};

export const createStudent = async (actor: AuthUser, dto: CreateStudentDto): Promise<StudentResponseDto> => {
  // Creating a student needs write:any — there is no existing row for canAccessStudent yet.
  if (!hasPermission(actor.role, 'students:write:any')) {
    throw forbidden('You cannot create students');
  }
  const student = await studentRepository.insert(toChanges(dto));
  return toResponseDto(student);
};

export const updateStudent = async (actor: AuthUser, id: number, dto: UpdateStudentDto): Promise<StudentResponseDto> => {
  const existing = await studentRepository.findById(id);
  if (!existing) throw notFound(`Student ${id} not found`);
  await assertCanAccess(actor, existing, 'write');
  const student = await studentRepository.update(id, toChanges(dto));
  if (!student) throw notFound(`Student ${id} not found`);
  return toResponseDto(student);
};

export const deleteStudent = async (actor: AuthUser, id: number): Promise<void> => {
  const existing = await studentRepository.findById(id);
  if (!existing) throw notFound(`Student ${id} not found`);
  await assertCanAccess(actor, existing, 'write');
  const deleted = await studentRepository.remove(id);
  if (!deleted) throw notFound(`Student ${id} not found`);
};
