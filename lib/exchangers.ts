// Выдача обменников в видимой области карты (SPEC: «API», FR-3, FR-9, правило склейки 2).

import { and, between, eq, isNotNull } from 'drizzle-orm';
import type { getDb } from './db/index.js';
import { exchangers, rates, type WeekHours } from './db/schema.js';
import { boundsCenter, inside, type Bounds } from './bounds.js';
import { distanceMeters } from './geo.js';
import { OFFICIAL_SOURCES } from './sources.js';

export { boundsSize, MAX_SIDE_M, type Bounds } from './bounds.js';

export const FRESH_MS = 15 * 60 * 1000;
const NEAREST_OUTSIDE = 3;
/** Насколько далеко от центра области искать ближайшие за её пределами (FR-9). */
const NEAREST_MAX_M = 20_000;

export function isStale(fetchedAt: Date | null, now = new Date()): boolean {
  return !fetchedAt || now.getTime() - fetchedAt.getTime() > FRESH_MS;
}

/** nearestFilter — какие обменники годятся в «ближайшие» (например, только с курсом нужной валюты). */
export function splitByBounds<T extends { lat: number; lng: number }>(
  points: T[],
  bounds: Bounds,
  nearestFilter: (p: T) => boolean = () => true,
): { inView: (T & { distance: number })[]; nearest: (T & { distance: number })[] } {
  const center = boundsCenter(bounds);
  const sorted = points
    .map((p) => ({ ...p, distance: Math.round(distanceMeters(center, p)) }))
    .sort((a, b) => a.distance - b.distance);
  return {
    inView: sorted.filter((p) => inside(p, bounds)),
    nearest: sorted
      .filter((p) => !inside(p, bounds) && p.distance <= NEAREST_MAX_M && nearestFilter(p))
      .slice(0, NEAREST_OUTSIDE),
  };
}

export interface RateRow {
  currency: string;
  buy: number | null;
  sell: number | null;
  rateUpdatedAt: Date | null;
  confirmedAt: Date;
  source: string;
}

const freshness = (r: RateRow) => (r.rateUpdatedAt ?? r.confirmedAt).getTime();
const official = (r: RateRow) => (OFFICIAL_SOURCES.includes(r.source) ? 1 : 0);

/** Из курсов разных источников — по одному на валюту: самый свежий, при равенстве — официальный. */
export function mergeRates(rows: RateRow[]): Record<string, RateRow> {
  const best: Record<string, RateRow> = {};
  for (const r of rows) {
    const cur = best[r.currency];
    if (!cur || freshness(r) > freshness(cur) || (freshness(r) === freshness(cur) && official(r) > official(cur))) {
      best[r.currency] = r;
    }
  }
  return best;
}

export interface ExchangerOut {
  id: string;
  country: string;
  city: string;
  name: string;
  bank: string | null;
  address: string;
  lat: number;
  lng: number;
  distance: number;
  hours: WeekHours | null;
  rates: Record<string, Omit<RateRow, 'currency'>>;
}

/** Обменники в области и ближайшие к ней (FR-9), с курсами, склеенными по правилу 2. */
export async function loadInBounds(
  db: ReturnType<typeof getDb>,
  bounds: Bounds,
  currency: string,
): Promise<{ inView: ExchangerOut[]; nearest: ExchangerOut[] }> {
  const center = boundsCenter(bounds);
  const dLat = NEAREST_MAX_M / 111_195;
  const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
  const rows = await db
    .select({ e: exchangers, r: rates })
    .from(exchangers)
    .leftJoin(rates, eq(rates.exchangerId, exchangers.id))
    .where(
      and(
        isNotNull(exchangers.lat),
        between(exchangers.lat, center.lat - dLat, center.lat + dLat),
        between(exchangers.lng, center.lng - dLng, center.lng + dLng),
      ),
    );

  const byId = new Map<string, { e: (typeof rows)[number]['e']; rates: RateRow[] }>();
  for (const { e, r } of rows) {
    const item = byId.get(e.id) ?? { e, rates: [] };
    if (r) {
      item.rates.push({
        currency: r.currency,
        buy: r.buy,
        sell: r.sell,
        rateUpdatedAt: r.rateUpdatedAt,
        confirmedAt: r.confirmedAt,
        source: r.source,
      });
    }
    byId.set(e.id, item);
  }

  const points = [...byId.values()].map(({ e, rates: list }) => {
    const merged = mergeRates(list);
    const out: Omit<ExchangerOut, 'distance'> = {
      id: e.id,
      country: e.country,
      city: e.city,
      name: e.name,
      bank: e.bank,
      address: e.address,
      lat: e.lat!,
      lng: e.lng!,
      hours: e.hours,
      rates: Object.fromEntries(Object.entries(merged).map(([cur, { currency: _, ...rest }]) => [cur, rest])),
    };
    return out;
  });
  return splitByBounds(points, bounds, (e) => Boolean(e.rates[currency]));
}
