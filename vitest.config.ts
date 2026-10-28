import { defineConfig } from 'vitest/config';

/**
 * Full mock env for tests. Mirrors .env.example so importing the app
 * never needs a real .env file or a live database password.
 */
export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USER: 'postgres',
      DB_PASSWORD: 'test',
      DB_NAME: 'postgres',
      DB_SCHEMA: 'express',
      PASS_PERCENTAGE: '40',
      ACADEMIC_YEAR: '2026-27',
      JWT_SECRET: 'test-jwt-secret-key',
      ACCESS_TOKEN_TTL_SECONDS: '900',
      CORS_ORIGINS: 'http://localhost:3000',
      MARKS_RATE_LIMIT_MAX: '60',
    },
    include: ['tests/**/*.test.ts'],
  },
});
