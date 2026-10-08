// Обновление «по запросу» (SPEC: «Архитектура»): что собирать сейчас, что — в фоне.

import { and, eq, inArray } from 'drizzle-orm';
import type { City } from './cities.js';
import { ADAPTERS, collectCity } from './collect.js';
import type { getDb } from './db/index.js';
import { cityFetches } from './db/schema.js';
import { isStale } from './exchangers.js';

type Db = ReturnType<typeof getDb>;

export interface RefreshPlan {
  /** Ещё ни разу не собирались — ждём сбора, иначе отдавать нечего. */
  firstTime: { source: string; city: string }[];
  /** Устарели — отдаём старое, собираем в фоне. */
  stale: { source: string; city: string }[];
  /** Время самого старого успешного сбора среди нужных источников. */
  oldestFetchedAt: Date | null;
}

export async function planRefresh(db: Db, cities: City[], now = new Date()): Promise<RefreshPlan> {
  const wanted = cities.flatMap((c) =>
    Object.entries(c.sources).map(([source, city]) => ({ source, city, country: c.country })),
  );
  if (!wanted.length) return { firstTime: [], stale: [], oldestFetchedAt: null };

  const rows = await db
    .select({ source: cityFetches.source, city: cityFetches.city, fetchedAt: cityFetches.fetchedAt })
    .from(cityFetches)
    .where(
      and(
        inArray(cityFetches.source, [...new Set(wanted.map((w) => w.source))]),
        inArray(cityFetches.city, [...new Set(wanted.map((w) => w.city))]),
      ),
    );
  const fetched = new Map(rows.map((r) => [`${r.source}|${r.city}`, r.fetchedAt]));

  const plan: RefreshPlan = { firstTime: [], stale: [], oldestFetchedAt: null };
  for (const { source, city } of wanted) {
    const at = fetched.get(`${source}|${city}`) ?? null;
    if (!at) plan.firstTime.push({ source, city });
    else {
      if (isStale(at, now, ADAPTERS[source]?.maxAgeMs)) plan.stale.push({ source, city });
      // Время данных показываем по источникам курсов, а не по редко обновляемым спискам.
      if (!ADAPTERS[source]?.maxAgeMs && (!plan.oldestFetchedAt || at < plan.oldestFetchedAt)) plan.oldestFetchedAt = at;
    }
  }
  return plan;
}

export async function runCollects(db: Db, jobs: { source: string; city: string }[]): Promise<void> {
  for (const { source, city } of jobs) {
    const outcome = await collectCity(db, source, city);
    if (outcome.status === 'error') console.error(`сбор ${source}/${city}: ${outcome.error}`);
  }
}
