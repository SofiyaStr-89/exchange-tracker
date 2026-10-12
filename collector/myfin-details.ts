// Часы работы и телефоны отделений из myfin (страницы отделений): только тем, у кого часов ещё нет.
// Медленно — одна страница в PAUSE_MS, чтобы не нагружать сайт. npm run myfin-details [-- <максимум страниц>]
// Еженедельно новые отделения дообходятся автоматически (их часов ещё нет).

import { and, eq, isNull, sql } from 'drizzle-orm';
import { parseMyfinDepartment } from '../lib/adapters/myfin.js';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { USER_AGENT } from '../lib/probe.js';

const PAUSE_MS = 3000;
const limit = Number(process.argv[2] ?? Infinity);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const db = getDb();
const todo = await db
  .select({ id: exchangers.id, page: sql<string>`${exchangers.sourceIds}->>'myfin_page'` })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'BY'), isNull(exchangers.hours), sql`${exchangers.sourceIds} ? 'myfin_page'`));

const stats = { pages: 0, hours: 0, phones: 0, failed: 0 };
for (const { id, page } of todo.slice(0, limit)) {
  if (stats.pages) await sleep(PAUSE_MS);
  stats.pages++;
  try {
    const res = await fetch(`https://myfin.by${page}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { hours, phone } = parseMyfinDepartment(await res.text());
    if (hours) stats.hours++;
    if (phone) stats.phones++;
    await db
      .update(exchangers)
      .set({ ...(hours ? { hours } : {}), ...(phone ? { phone: sql`coalesce(${exchangers.phone}, ${phone})` } : {}) })
      .where(eq(exchangers.id, id));
  } catch (err) {
    stats.failed++;
    console.log(`✗ ${page}: ${err instanceof Error ? err.message : err}`);
  }
  if (stats.pages % 25 === 0) console.log(`…${stats.pages}/${Math.min(todo.length, limit)}`, stats);
}
console.log(`Без часов было: ${todo.length}.`, stats);
