import { z } from 'zod';

/**
 * Shared checks used by the student and mark request schemas.
 * Each export is a small Zod schema so error paths stay on the right field.
 */

const forbidden = (value: string): boolean =>
  /[\u0000-\u001F\u007F]/.test(value) || value.includes('<') || value.includes('>');

/** Trim, NFC-normalise, and reject control characters, null bytes, and < >. */
export const safeText = z.string().superRefine((value, ctx) => {
  const text = value.normalize('NFC').trim();
  if (forbidden(text)) {
    ctx.addIssue({ code: 'custom', message: 'contains forbidden characters' });
  }
}).transform((value) => value.normalize('NFC').trim());

/** A person's name: letters, spaces, apostrophes, hyphens, and periods. */
export const personName = safeText.pipe(
  z.string().min(1, 'is required').max(80, 'is too long').regex(/^[A-Za-z][A-Za-z .'-]*$/, 'must be a name made of letters'),
);

const classNames = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);

/** Accepts the string "7" or the JSON number 7, and always stores "7". */
export const className = z.union([z.string(), z.number()]).superRefine((value, ctx) => {
  const text = String(value).normalize('NFC').trim();
  if (!classNames.has(text)) {
    ctx.addIssue({ code: 'custom', message: 'must be a class from 1 to 12' });
  }
}).transform((value) => String(value).normalize('NFC').trim());

/** Query strings are always text, so this version does not accept a JSON number. */
export const classNameText = z.string().trim().refine((value) => classNames.has(value), 'must be a class from 1 to 12');

export const section = z.string().superRefine((value, ctx) => {
  const text = value.normalize('NFC').trim().toUpperCase();
  if (forbidden(text) || !/^[A-F]$/.test(text)) {
    ctx.addIssue({ code: 'custom', message: 'must be a single letter from A to F' });
  }
}).transform((value) => value.normalize('NFC').trim().toUpperCase());

export const rollNo = z.string().superRefine((value, ctx) => {
  const text = value.normalize('NFC').trim().toUpperCase();
  if (forbidden(text) || !/^\d{4}-\d{1,2}[A-F]-\d{3}$/.test(text)) {
    ctx.addIssue({ code: 'custom', message: 'must look like 2026-10A-017' });
  }
}).transform((value) => value.normalize('NFC').trim().toUpperCase());

function ageInYears(dateOfBirth: Date, today: Date): number {
  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** "YYYY-MM-DD" that is a real calendar date, and an age from 3 to 25. */
export const dateOfBirth = z.string().trim().superRefine((value, ctx) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    ctx.addIssue({ code: 'custom', message: 'must be a real date in YYYY-MM-DD form' });
    return;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) {
    ctx.addIssue({ code: 'custom', message: 'must be a real date in YYYY-MM-DD form' });
    return;
  }
  const age = ageInYears(date, new Date());
  if (age < 3 || age > 25) {
    ctx.addIssue({ code: 'custom', message: 'student must be between 3 and 25 years old' });
  }
});

/** Trim, drop spaces and dashes, then require E.164: +919876543210. */
export const phone = z.string().superRefine((value, ctx) => {
  const text = value.normalize('NFC').trim().replace(/[\s-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(text)) {
    ctx.addIssue({ code: 'custom', message: 'must be an E.164 phone number such as +919876543210' });
  }
}).transform((value) => value.normalize('NFC').trim().replace(/[\s-]/g, ''));

export const guardianRelation = z.string().transform((value) => value.normalize('NFC').trim().toLowerCase()).pipe(
  z.enum(['father', 'mother', 'guardian']),
);

/** Lowercase slug used for subject names, such as "maths" or "social-science". */
export const tag = safeText.pipe(
  z.string().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug such as "maths"'),
);

const atMostTwoDecimals = (value: number): boolean => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

export const scoreValue = z.number().min(0, 'must be 0 or more').refine(atMostTwoDecimals, 'at most 2 decimal places');

export const maxScoreValue = z
  .number()
  .min(1, 'must be from 1 to 200')
  .max(200, 'must be from 1 to 200')
  .refine(atMostTwoDecimals, 'at most 2 decimal places');

export const examName = z.enum(['unit-1', 'midterm', 'unit-2', 'final']);

/** Page size and starting row. limit=100000 is rejected. Missing values are allowed. */
export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
};

/** Route param :id, for example /api/students/4. */
export const idParam = z.object({
  id: z.coerce.number().int().positive('id must be a positive whole number'),
});

/** Stop % and _ in a search box from acting as SQL LIKE wildcards. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Turn "" from a query string into "not provided". */
export function emptyToUndefined(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  return value;
}
