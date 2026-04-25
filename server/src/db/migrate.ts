import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to run migrations');
}

// __dirname tương đương cho ESM — migrations folder copy cùng compile
// (xem Dockerfile production stage).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function runMigrations(): Promise<void> {
  const sql = postgres(connectionString!, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, {
      migrationsFolder: resolve(__dirname, 'migrations'),
    });
  } finally {
    await sql.end();
  }
}
