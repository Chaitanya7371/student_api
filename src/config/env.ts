import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * Thrown when .env is missing a value or a value is the wrong shape.
 * The server prints the message and exits. Tests catch the error instead.
 */
export function configError(message: string): Error {
  const error = new Error(message);
  error.name = 'ConfigError';
  return error;
}

const passPercentage = z.any().superRefine((value, ctx) => {
  if (value === undefined || value === null || value === '') {
    ctx.addIssue({ code: 'custom', message: 'PASS_PERCENTAGE is required but missing' });
    return;
  }
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'string' && value.trim() === '') {
    ctx.addIssue({ code: 'custom', message: 'PASS_PERCENTAGE is required but missing' });
    return;
  }
  if (Number.isNaN(numberValue)) {
    ctx.addIssue({ code: 'custom', message: `PASS_PERCENTAGE must be a number (received "${String(value)}")` });
    return;
  }
  if (numberValue < 0 || numberValue > 100) {
    ctx.addIssue({
      code: 'custom',
      message: `PASS_PERCENTAGE must be between 0 and 100 (received "${String(value)}")`,
    });
  }
}).transform((value) => Number(value));

const academicYear = z.any().superRefine((value, ctx) => {
  if (value === undefined || value === null || value === '') {
    ctx.addIssue({ code: 'custom', message: 'ACADEMIC_YEAR is required but missing' });
    return;
  }
  const text = String(value);
  if (!/^\d{4}-\d{2}$/.test(text)) {
    ctx.addIssue({
      code: 'custom',
      message: `ACADEMIC_YEAR must look like "YYYY-YY" (received "${text}")`,
    });
    return;
  }
  const [firstText, secondText] = text.split('-');
  const first = Number(firstText);
  const second = Number(secondText);
  if (second !== (first + 1) % 100) {
    ctx.addIssue({
      code: 'custom',
      message: `ACADEMIC_YEAR: second year must follow the first (received "${text}")`,
    });
  }
}).transform((value) => String(value));

const corsOrigins = z.any().superRefine((value, ctx) => {
  if (value === undefined || value === null || value === '') {
    ctx.addIssue({ code: 'custom', message: 'CORS_ORIGINS is required but missing' });
    return;
  }
  const text = String(value).trim();
  if (text === '*') {
    ctx.addIssue({
      code: 'custom',
      message:
        'CORS_ORIGINS cannot be "*" — allowing every origin lets any website read authenticated API responses from a logged-in browser',
    });
    return;
  }
  for (const origin of text.split(',').map((part) => part.trim()).filter(Boolean)) {
    if (!/^https?:\/\/.+/i.test(origin)) {
      ctx.addIssue({
        code: 'custom',
        message: `CORS_ORIGINS must be a full URL (received "${origin}")`,
      });
    }
  }
}).transform((value) =>
  String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean),
);

const marksRateLimitMax = z
  .any()
  .optional()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null || value === '') return;
    const numberValue = Number(value);
    if (Number.isNaN(numberValue) || !Number.isInteger(numberValue) || numberValue < 1) {
      ctx.addIssue({
        code: 'custom',
        message: `MARKS_RATE_LIMIT_MAX must be a positive whole number (received "${String(value)}")`,
      });
    }
  })
  .transform((value) => (value === undefined || value === null || value === '' ? 60 : Number(value)));

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1).default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1).default('postgres'),
  DB_SCHEMA: z.string().min(1).default('express'),
  PASS_PERCENTAGE: passPercentage,
  ACADEMIC_YEAR: academicYear,
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  CORS_ORIGINS: corsOrigins,
  MARKS_RATE_LIMIT_MAX: marksRateLimitMax,
});

export type Env = z.infer<typeof configSchema>;

/** Read environment variables and return a typed config, or throw ConfigError. */
export const validateConfig = (source: Record<string, unknown> = process.env): Env => {
  const result = configSchema.safeParse({
    NODE_ENV: source.NODE_ENV,
    PORT: source.PORT,
    DB_HOST: source.DB_HOST,
    DB_PORT: source.DB_PORT,
    DB_USER: source.DB_USER,
    DB_PASSWORD: source.DB_PASSWORD,
    DB_NAME: source.DB_NAME,
    DB_SCHEMA: source.DB_SCHEMA,
    PASS_PERCENTAGE: source.PASS_PERCENTAGE,
    ACADEMIC_YEAR: source.ACADEMIC_YEAR,
    JWT_SECRET: source.JWT_SECRET,
    ACCESS_TOKEN_TTL_SECONDS: source.ACCESS_TOKEN_TTL_SECONDS,
    CORS_ORIGINS: source.CORS_ORIGINS,
    MARKS_RATE_LIMIT_MAX: source.MARKS_RATE_LIMIT_MAX,
  });

  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('\n');
    throw configError(message);
  }

  return result.data;
};

function loadEnv(): Env {
  try {
    return validateConfig();
  } catch (error) {
    if (process.env.VITEST) throw error;
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
