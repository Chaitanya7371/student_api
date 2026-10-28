import { badRequest, conflict, notFound } from '../../errors/AppError.js';
import { isForeignKeyViolation, isUniqueViolation } from '../../errors/dbError.js';
import { isStudentAccount, isTeacherAccount } from '../../config/permissions.js';
import * as accessRepository from '../access/access.repository.js';
import * as studentRepository from '../student/student.repository.js';
import * as userRepository from '../user/user.repository.js';
import type { StudentLinkDto, TeacherClassDto } from './admin.dto.js';

export const assignTeacherClass = async (dto: TeacherClassDto) => {
  const teacher = await userRepository.findUserById(dto.teacherUserId);
  if (!teacher) throw notFound(`User ${dto.teacherUserId} not found`);

  if (!isTeacherAccount(teacher.role)) {
    throw badRequest('Target account is not a teacher', {
      fieldErrors: { teacherUserId: ['must be a teacher account'] },
    });
  }

  try {
    const link = await accessRepository.insertTeacherClass(dto.teacherUserId, dto.className, dto.section);
    return {
      teacherUserId: link.teacherUserId,
      className: link.className,
      section: link.section,
    };
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict('That teacher is already linked to this class and section');
    if (isForeignKeyViolation(error)) throw notFound(`User ${dto.teacherUserId} not found`);
    throw error;
  }
};

export const linkStudentAccount = async (dto: StudentLinkDto) => {
  const account = await userRepository.findUserById(dto.userId);
  if (!account) throw notFound(`User ${dto.userId} not found`);

  if (!isStudentAccount(account.role)) {
    throw badRequest('Target account is not a student', {
      fieldErrors: { userId: ['must be a student account'] },
    });
  }

  const student = await studentRepository.findById(dto.studentId);
  if (!student) throw notFound(`Student ${dto.studentId} not found`);

  if (account.studentId !== null) {
    throw conflict('That user is already linked to a student');
  }

  const linked = await userRepository.linkStudent(dto.userId, dto.studentId);
  if (!linked) throw notFound(`User ${dto.userId} not found`);

  return {
    userId: linked.id,
    studentId: linked.studentId,
  };
};
