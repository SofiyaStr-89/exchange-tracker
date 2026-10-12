// Адаптер «сайт обменника» (шаг 5а): курсы со своих сайтов kantorów, у которых сайт известен из других
// источников (OSM, kantor.live, marketportal). Вёрстка у всех разная — общий разборщик lib/extract-rates.ts
// со сверкой с NBP (правило склейки 7). Курсы присваиваются всем точкам с этим сайтом.

import { and, eq, isNotNull } from 'drizzle-orm';
import type { City } from '../cities.js';
import type { getDb } from '../db/index.js';
import { exchangers } from '../db/schema.js';
import { extractRates, extractTimestamp } from '../extract-rates.js';
import { loadNbpMids } from '../nbp.js';
import { USER_AGENT } from '../probe.js';
import type { AdapterResult, NormalizedRate } from './types.js';

export const SOURCE = 'site';
/** Каждый сайт — не чаще раза в час (SPEC: «Вежливость к источникам»). */
export const MAX_AGE_MS = 60 * 60 * 1000;
/** Сайты, у которых есть свой адаптер, — не трогаем дважды. */
const OWN_ADAPTERS = /(^|\.)(kantor\.live|marketportal\.pl|exg\.pl|kantorsprawa\.pl)$/;
/** Одновременно открытых сайтов (разные сайты — каждому всё равно один запрос). */
const CONCURRENCY = 5;
const ROBOTS_CACHE_MS = 24 * 60 * 60 * 1000;

const robotsCache = new Map<string, { at: number; allowed: boolean }>();

export function robotsAllows(txt: string, path: string): boolean {
  let applies = false;
  let allowed = true;
  let longest = -1;
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const key = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();
    if (key === 'user-agent') applies = value === '*' || /exchangemapbot/i.test(value);
    else if (applies && (key === 'disallow' || key === 'allow') && value && path.startsWith(value) && value.length > longest) {
      longest = value.length;
      allowed = key === 'allow';
    }
  }
  return allowed;
}

async function allowedByRobots(url: URL): Promise<boolean> {
  const cached = robotsCache.get(url.origin);
  if (cached && Date.now() - cached.at < ROBOTS_CACHE_MS) return cached.allowed;
  let allowed = true;
  try {
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (res.ok) allowed = robotsAllows(await res.text(), url.pathname || '/');
  } catch {
    // нет robots.txt — ограничений нет
  }
  robotsCache.set(url.origin, { at: Date.now(), allowed });
  return allowed;
}

export async function collectSites(db: ReturnType<typeof getDb>, city: City): Promise<AdapterResult> {
  const rows = await db
    .select({ id: exchangers.id, website: exchangers.website })
    .from(exchangers)
    .where(and(eq(exchangers.city, city.name), isNotNull(exchangers.website)));

  const byUrl = new Map<string, string[]>();
  for (const r of rows) {
    const url = new URL(r.website!);
    if (OWN_ADAPTERS.test(url.host.replace(/^www\./, ''))) continue;
    url.hash = '';
    byUrl.set(url.toString(), [...(byUrl.get(url.toString()) ?? []), r.id]);
  }
  if (!byUrl.size) return { exchangers: [], rates: [] };

  const mids = await loadNbpMids();
  const cityPattern = new RegExp(city.aliases.join('|'), 'i');
  const rates: NormalizedRate[] = [];
  const queue = [...byUrl.entries()];

  async function worker(): Promise<void> {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const [href, ids] = job;
      const url = new URL(href);
      try {
        if (!(await allowedByRobots(url))) continue;
        const res = await fetch(href, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
        if (!res.ok) continue;
        const html = await res.text();
        // Страница должна быть про этот город: у сетей на главной бывает другой филиал (valuta.com.pl — Краков).
        if (!cityPattern.test(html)) continue;
        const found = extractRates(html, mids);
        const updatedAt = extractTimestamp(html);
        for (const [currency, r] of Object.entries(found)) {
          for (const exchangerId of ids) rates.push({ exchangerId, currency, buy: r.buy, sell: r.sell, rateUpdatedAt: updatedAt, source: SOURCE });
        }
      } catch {
        // один сайт не ответил — остальные собираем
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { exchangers: [], rates };
}
