import { z } from 'zod';
import {
  classNameText,
  emptyToUndefined,
  examName,
  maxScoreValue,
  scoreValue,
  section,
  tag,
} from '../../utils/validators.js';

const markItemDto = z.strictObject({
  subject: tag,
  score: scoreValue,
  maxScore: maxScoreValue.default(100),
});

export const createMarksDto = z.strictObject({
  exam: examName,
  marks: z
    .array(markItemDto)
    .min(1, 'provide at least one mark')
    .max(15, 'at most 15 marks')
    .superRefine((items, ctx) => {
      items.forEach((item, index) => {
        if (item.score > item.maxScore) {
          ctx.addIssue({
            code: 'custom',
            message: 'score must be less than or equal to maxScore',
            path: [index, 'score'],
          });
        }
      });

      const subjects = items.map((item) => item.subject);
      if (new Set(subjects).size !== subjects.length) {
        ctx.addIssue({ code: 'custom', message: 'subjects must be unique', path: [] });
      }
    }),
});
export type CreateMarksDto = z.infer<typeof createMarksDto>;

export const updateMarkDto = z
  .strictObject({
    score: scoreValue.optional(),
    maxScore: maxScoreValue.optional(),
  })
  .refine((body) => body.score !== undefined || body.maxScore !== undefined, {
    message: 'Provide score or maxScore',
  });
export type UpdateMarkDto = z.infer<typeof updateMarkDto>;

export const averagesQueryDto = z.object({
  className: classNameText,
  exam: z.preprocess(emptyToUndefined, examName.optional()),
  section: z.preprocess(emptyToUndefined, section.optional()),
});
export type AveragesQueryDto = z.infer<typeof averagesQueryDto>;

export interface MarkResponseDto {
  id: number;
  studentId: number;
  exam: 'unit-1' | 'midterm' | 'unit-2' | 'final';
  subject: string;
  score: number;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectAverageResponseDto {
  subject: string;
  averagePercentage: number;
  students: number;
  passed: boolean;
}
