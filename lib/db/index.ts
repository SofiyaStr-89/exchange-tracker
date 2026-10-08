// Клиент базы для функций Vercel и скриптов. HTTP-драйвер Neon без пула:
// serverless-функции живут недолго. Строка подключения только на сервере.

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL не задан — см. .env.example');
  return drizzle(neon(url), { schema });
}
