import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client';

async function main() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  await pool.end();
  // eslint-disable-next-line no-console
  console.log('Migrations complete.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
