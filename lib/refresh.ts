// Обновление «по запросу» (SPEC: «Архитектура»): что собирать сейчас, что — в фоне, что пока не трогать.

import { and, inArray } from 'drizzle-orm';
import type { City } from './cities.js';
import { ADAPTERS, collectCity } from './collect.js';
import type { getDb } from './db/index.js';
import { cityFetches } from './db/schema.js';
import { FRESH_MS } from './exchangers.js';

type Db = ReturnType<typeof getDb>;

const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
type Job = { source: string; city: string };

export interface FetchRow {
  source: string;
  city: string;
  fetchedAt: Date | null;
  startedAt: Date | null;
  status: 'ok' | 'error' | 'running';
}

export interface RefreshPlan {
  /** По городу ещё нет данных ни из одного источника — ждём сбора, иначе отдавать нечего. */
  firstTime: Job[];
  /** Устарели или ещё не собирались при уже собранном городе — отдаём что есть, собираем в фоне. */
  stale: Job[];
  /** Время самого старого успешного сбора среди источников курсов (не списков вроде OSM). */
  oldestFetchedAt: Date | null;
}

/** Чистое решение по строкам city_fetches; maxAgeMs — срок свежести источника. */
export function decideRefresh(
  wanted: Job[],
  rows: FetchRow[],
  now: Date,
  maxAgeMs: (source: string) => number,
  /** Основные источники ждём при первом открытии города; остальные дособираются в фоне. */
  isPrimary: (source: string) => boolean = () => true,
): RefreshPlan {
  const byKey = new Map(rows.map((r) => [`${r.source}|${r.city}`, r]));
  const anyData = wanted.some((w) => byKey.get(`${w.source}|${w.city}`)?.fetchedAt);
  const plan: RefreshPlan = { firstTime: [], stale: [], oldestFetchedAt: null };

  for (const job of wanted) {
    const row = byKey.get(`${job.source}|${job.city}`);
    const age = maxAgeMs(job.source);
    // Недавно упал — не дёргаем мёртвый сайт на каждом открытии карты; но и неделю (OSM) не ждём — не дольше часа.
    const retryAfter = Math.min(age, RETRY_AFTER_FAILURE_MS);
    const recentFailure = row?.status === 'error' && row.startedAt && now.getTime() - row.startedAt.getTime() < retryAfter;
    if (row?.fetchedAt && job.source !== 'osm' && (!plan.oldestFetchedAt || row.fetchedAt < plan.oldestFetchedAt)) {
      plan.oldestFetchedAt = row.fetchedAt;
    }
    if (recentFailure) continue;
    if (!row?.fetchedAt) (anyData || !isPrimary(job.source) ? plan.stale : plan.firstTime).push(job);
    else if (now.getTime() - row.fetchedAt.getTime() > age) plan.stale.push(job);
  }
  return plan;
}

export async function planRefresh(db: Db, cities: City[], now = new Date()): Promise<RefreshPlan> {
  const wanted = cities.flatMap((c) => Object.entries(c.sources).map(([source, city]) => ({ source, city })));
  if (!wanted.length) return { firstTime: [], stale: [], oldestFetchedAt: null };
  const rows = await db
    .select({
      source: cityFetches.source,
      city: cityFetches.city,
      fetchedAt: cityFetches.fetchedAt,
      startedAt: cityFetches.startedAt,
      status: cityFetches.status,
    })
    .from(cityFetches)
    .where(
      and(
        inArray(cityFetches.source, [...new Set(wanted.map((w) => w.source))]),
        inArray(cityFetches.city, [...new Set(wanted.map((w) => w.city))]),
      ),
    );
  return decideRefresh(
    wanted,
    rows,
    now,
    (source) => ADAPTERS[source]?.maxAgeMs ?? FRESH_MS,
    (source) => ADAPTERS[source]?.primary === true,
  );
}

export async function runCollects(db: Db, jobs: Job[]): Promise<void> {
  for (const { source, city } of jobs) {
    const outcome = await collectCity(db, source, city);
    if (outcome.status === 'error') console.error(`сбор ${source}/${city}: ${outcome.error}`);
  }
}
