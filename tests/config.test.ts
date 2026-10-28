import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/config/env.js';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'postgres',
  DB_PASSWORD: 'test',
  DB_NAME: 'postgres',
  DB_SCHEMA: 'express',
  PASS_PERCENTAGE: '33.5',
  ACADEMIC_YEAR: '2026-27',
  JWT_SECRET: 'test-jwt-secret-key',
  ACCESS_TOKEN_TTL_SECONDS: '900',
  CORS_ORIGINS: 'http://localhost:3000',
  MARKS_RATE_LIMIT_MAX: '60',
};

describe('validateConfig', () => {
  it('parses PASS_PERCENTAGE "33.5" into the number 33.5', () => {
    const config = validateConfig(valid);
    expect(config.PASS_PERCENTAGE).toBe(33.5);
    expect(config.ACADEMIC_YEAR).toBe('2026-27');
  });

  it('says PASS_PERCENTAGE is required but missing', () => {
    expect(() => validateConfig({ ...valid, PASS_PERCENTAGE: undefined })).toThrow(/PASS_PERCENTAGE is required but missing/);
  });

  it('rejects PASS_PERCENTAGE abc and 150 with a clear message', () => {
    expect(() => validateConfig({ ...valid, PASS_PERCENTAGE: 'abc' })).toThrow(/must be a number \(received "abc"\)/);
    expect(() => validateConfig({ ...valid, PASS_PERCENTAGE: '150' })).toThrow(/between 0 and 100 \(received "150"\)/);
  });

  it('rejects ACADEMIC_YEAR 26-27 and 2026-28 with a clear message', () => {
    expect(() => validateConfig({ ...valid, ACADEMIC_YEAR: '26-27' })).toThrow(/YYYY-YY" \(received "26-27"\)/);
    expect(() => validateConfig({ ...valid, ACADEMIC_YEAR: '2026-28' })).toThrow(
      /second year must follow the first \(received "2026-28"\)/,
    );
  });

  it('rejects CORS_ORIGINS=* with a clear allow-all warning', () => {
    expect(() => validateConfig({ ...valid, CORS_ORIGINS: '*' })).toThrow(
      'CORS_ORIGINS cannot be "*" — allowing every origin lets any website read authenticated API responses from a logged-in browser',
    );
  });
});
