import { z } from 'zod';
import {
  className,
  classNameText,
  dateOfBirth,
  emptyToUndefined,
  guardianRelation,
  pagination,
  personName,
  phone,
  rollNo,
  safeText,
  section,
} from '../../utils/validators.js';

const guardianDto = z.strictObject({
  name: personName,
  phone,
  relation: guardianRelation,
});

export const createStudentDto = z.strictObject({
  rollNo,
  firstName: personName,
  lastName: personName,
  dateOfBirth,
  className,
  section,
  guardian: guardianDto,
});
export type CreateStudentDto = z.infer<typeof createStudentDto>;

/** PATCH can send any subset. If guardian is sent, the whole guardian object is required. */
export const updateStudentDto = z
  .strictObject({
    rollNo: rollNo.optional(),
    firstName: personName.optional(),
    lastName: personName.optional(),
    dateOfBirth: dateOfBirth.optional(),
    className: className.optional(),
    section: section.optional(),
    guardian: guardianDto.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });
export type UpdateStudentDto = z.infer<typeof updateStudentDto>;

export const listStudentsQueryDto = z.object({
  className: z.preprocess(emptyToUndefined, classNameText.optional()),
  section: z.preprocess(emptyToUndefined, section.optional()),
  search: z.preprocess(emptyToUndefined, safeText.pipe(z.string().max(100)).optional()),
  limit: z.preprocess(emptyToUndefined, pagination.limit),
  offset: z.preprocess(emptyToUndefined, pagination.offset),
});
export type ListStudentsQueryDto = z.infer<typeof listStudentsQueryDto>;

export interface StudentResponseDto {
  id: number;
  rollNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  className: string;
  section: string;
  guardian: {
    name: string;
    phone: string;
    relation: 'father' | 'mother' | 'guardian';
  };
  createdAt: string;
  updatedAt: string;
}
