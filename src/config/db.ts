import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const quoteIdent = (value: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
};

/** schema.table, with both parts restricted to plain identifiers. */
export const table = (name: string): string => `${quoteIdent(env.DB_SCHEMA)}.${quoteIdent(name)}`;

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
});

const schemaFile = path.join(process.cwd(), 'db', 'schema.sql');

let ready: Promise<void> | undefined;

/** Creates the schema and tables from db/schema.sql. Safe to call more than once. */
export const initDb = (): Promise<void> => {
  if (!env.DB_PASSWORD) {
    return Promise.reject(
      new Error('DB_PASSWORD is empty. Set it in .env to the password for the postgres user in DBeaver.'),
    );
  }

  ready ??= (async () => {
    const sql = fs.readFileSync(schemaFile, 'utf8');
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(env.DB_SCHEMA)}`);
      await client.query(`SET search_path TO ${quoteIdent(env.DB_SCHEMA)}`);
      await client.query(sql);
    } finally {
      client.release();
    }
  })();

  return ready;
};

/** Empties every app table. Used by tests so each run starts from a clean database. */
export const clearTables = async (): Promise<void> => {
  await initDb();
  await pool.query(
    `TRUNCATE ${table('teacher_classes')}, ${table('marks')}, ${table('students')}, ${table('users')} RESTART IDENTITY CASCADE`,
  );
};
