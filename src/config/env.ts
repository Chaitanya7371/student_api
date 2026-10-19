import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
};

export const isProduction = env.NODE_ENV === 'production'