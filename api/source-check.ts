// GET /api/source-check?source=kursarz — пускает ли выключенный источник наш сервер (Vercel) снова.
// kursarz.pl с 06.11.2026 отвечал серверу 503, а обычному компьютеру — 200; проверка должна идти именно отсюда.
// Не чаще одного запроса к источнику в CHECK_EVERY_MS: остальные вызовы получают сохранённый ответ.

import { and, eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { cityFetches } from '../lib/db/schema.js';
import { USER_AGENT } from '../lib/probe.js';

const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
/** Только выключенные источники и одна страница каждого — адрес не годится для запросов к чему-то ещё. */
const PROBES: Record<string, string> = {
  kursarz: 'https://kursarz.pl/kantory/kursy-walut.html?filter_val=USD&filter_city=Warszawa&limit=0',
};

export async function GET(request: Request): Promise<Response> {
  const source = new URL(request.url).searchParams.get('source') ?? '';
  const url = PROBES[source];
  if (!url) return Response.json({ error: `source: ${Object.keys(PROBES).join(', ')}` }, { status: 400 });
  const db = getDb();
  const key = and(eq(cityFetches.source, `probe:${source}`), eq(cityFetches.country, 'PL'), eq(cityFetches.city, 'all'));
  const [last] = await db.select().from(cityFetches).where(key);
  if (last?.startedAt && Date.now() - last.startedAt.getTime() < CHECK_EVERY_MS) {
    return Response.json({ source, ok: last.status === 'ok', detail: last.error, checkedAt: last.startedAt, cached: true });
  }
  let ok = false;
  let detail: string | null = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    ok = res.ok && (await res.text()).includes('filter_val');
    detail = ok ? null : `HTTP ${res.status}`;
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }
  const now = new Date();
  await db
    .insert(cityFetches)
    .values({ source: `probe:${source}`, country: 'PL', city: 'all', status: ok ? 'ok' : 'error', error: detail, startedAt: now, fetchedAt: ok ? now : null })
    .onConflictDoUpdate({
      target: [cityFetches.source, cityFetches.country, cityFetches.city],
      set: { status: ok ? 'ok' : 'error', error: detail, startedAt: now, ...(ok ? { fetchedAt: now } : {}) },
    });
  return Response.json({ source, ok, detail, checkedAt: now, cached: false }, { headers: { 'Cache-Control': 'no-store' } });
}
