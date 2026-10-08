// Запись результата адаптера в базу (SPEC: «Модель данных», правила склейки 3 и 6).

import { and, eq, gt, sql } from 'drizzle-orm';
import type { getDb } from './db/index.js';
import { cityFetches, exchangers, rates } from './db/schema.js';
import type { AdapterResult, Country } from './adapters/types.js';

type Db = ReturnType<typeof getDb>;

const CHUNK = 500;
const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

export async function saveResult(db: Db, result: AdapterResult): Promise<void> {
  for (const part of chunks(result.exchangers)) {
    await db
      .insert(exchangers)
      .values(part.map((e) => ({ ...e, updatedAt: new Date() })))
      .onConflictDoUpdate({
        target: exchangers.id,
        set: {
          name: sql`excluded.name`,
          city: sql`excluded.city`,
          address: sql`excluded.address`,
          bank: sql`excluded.bank`,
          hours: sql`excluded.hours`,
          // Источник без координат не затирает найденные геокодером (правило 3).
          lat: sql`coalesce(excluded.lat, ${exchangers.lat})`,
          lng: sql`coalesce(excluded.lng, ${exchangers.lng})`,
          coordsSource: sql`coalesce(excluded.coords_source, ${exchangers.coordsSource})`,
          sourceIds: sql`${exchangers.sourceIds} || excluded.source_ids`,
          updatedAt: sql`now()`,
        },
      });
  }

  for (const part of chunks(result.rates)) {
    await db
      .insert(rates)
      .values(part)
      .onConflictDoUpdate({
        target: [rates.exchangerId, rates.currency, rates.source],
        set: {
          buy: sql`excluded.buy`,
          sell: sql`excluded.sell`,
          rateUpdatedAt: sql`excluded.rate_updated_at`,
          // fetched_at — когда значение впервые увидели; confirmed_at — последний сбор с этим значением (правило 6).
          fetchedAt: sql`case when ${rates.buy} is distinct from excluded.buy or ${rates.sell} is distinct from excluded.sell
            then now() else ${rates.fetchedAt} end`,
          confirmedAt: sql`now()`,
        },
      });
  }
}

const LOCK_SECONDS = 120;

/** Отмечает начало сбора. false — этот город уже собирается (защита от параллельного сбора). */
export async function startCityFetch(db: Db, source: string, country: Country, city: string): Promise<boolean> {
  const busy = await db
    .select({ source: cityFetches.source })
    .from(cityFetches)
    .where(
      and(
        eq(cityFetches.source, source),
        eq(cityFetches.country, country),
        eq(cityFetches.city, city),
        eq(cityFetches.status, 'running'),
        gt(cityFetches.startedAt, sql`now() - make_interval(secs => ${LOCK_SECONDS})`),
      ),
    );
  if (busy.length) return false;
  await db
    .insert(cityFetches)
    .values({ source, country, city, status: 'running', startedAt: new Date() })
    .onConflictDoUpdate({
      target: [cityFetches.source, cityFetches.country, cityFetches.city],
      set: { status: 'running', startedAt: sql`now()` },
    });
  return true;
}

export async function finishCityFetch(
  db: Db,
  source: string,
  country: Country,
  city: string,
  error: string | null,
): Promise<void> {
  await db
    .update(cityFetches)
    .set(error ? { status: 'error', error } : { status: 'ok', error: null, fetchedAt: sql`now()` })
    .where(and(eq(cityFetches.source, source), eq(cityFetches.country, country), eq(cityFetches.city, city)));
}
