import { initDb, pool } from './db.js';

/** npm run db:migrate — create the express schema and the school tables. */
initDb()
  .then(() => pool.end())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
