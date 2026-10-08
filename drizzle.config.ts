import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local', quiet: true });

const pooled = process.env.DATABASE_URL;
if (!pooled) throw new Error('Нет DATABASE_URL в .env.local');
// Миграции идут мимо пула соединений: DDL через pgbouncer ведёт себя непредсказуемо.
const url = pooled.replace('-pooler.', '.');

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});
