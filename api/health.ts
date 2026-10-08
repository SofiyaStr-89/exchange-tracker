// GET /api/health — состояние сервиса, базы и адаптеров источников (SPEC: «API»).

import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { cityFetches } from '../lib/db/schema.js';

export interface SourceHealth {
  source: string;
  lastSuccessAt: string | null;
  lastError: string | null;
}

type DatabaseState = 'ok' | 'error' | 'not_configured';

async function readSources(): Promise<{ database: DatabaseState; sources: SourceHealth[] }> {
  if (!process.env.DATABASE_URL) return { database: 'not_configured', sources: [] };
  try {
    const rows = await getDb()
      .select({
        source: cityFetches.source,
        lastSuccessAt: sql<string | null>`max(${cityFetches.fetchedAt})`,
        lastError: sql<string | null>`(array_agg(${cityFetches.error} order by ${cityFetches.startedAt} desc)
          filter (where ${cityFetches.status} = 'error'))[1]`,
      })
      .from(cityFetches)
      .groupBy(cityFetches.source)
      .orderBy(cityFetches.source);
    return { database: 'ok', sources: rows };
  } catch (err) {
    console.error('health: база недоступна', err instanceof Error ? err.message : err);
    return { database: 'error', sources: [] };
  }
}

export async function GET(): Promise<Response> {
  const { database, sources } = await readSources();
  return Response.json({ status: 'ok', database, time: new Date().toISOString(), sources });
}
