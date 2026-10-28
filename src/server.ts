import app from './app.js';
import { initDb } from './config/db.js';
import { env } from './config/env.js';

initDb()
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
    });
  })
  .catch((error: unknown) => {
    console.error('Failed to connect to PostgreSQL:', error);
    process.exit(1);
  });
