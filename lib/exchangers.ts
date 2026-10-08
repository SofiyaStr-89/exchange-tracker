// Выдача обменников вокруг точки (SPEC: «API», FR-9, правило склейки 2).

import { and, between, eq, isNotNull } from 'drizzle-orm';
import type { getDb } from './db/index.js';
import { exchangers, rates, type WeekHours } from './db/schema.js';
import { distanceMeters } from './geo.js';
import { OFFICIAL_SOURCES } from './sources.js';

export const FRESH_MS = 15 * 60 * 1000;
export const MAX_RADIUS_M = 2000;
const NEAREST_OUTSIDE = 3;
/** Насколько далеко искать «3 ближайших» за радиусом (FR-9). */
const SEARCH_RADIUS_M = 20_000;

export function isStale(fetchedAt: Date | null, now = new Date()): boolean {
  return !fetchedAt || now.getTime() - fetchedAt.getTime() > FRESH_MS;
}

export function splitByRadius<T extends { lat: number; lng: number }>(
  points: T[],
  center: { lat: number; lng: number },
  radius: number,
): { inRadius: (T & { distance: number })[]; nearest: (T & { distance: number })[] } {
  const sorted = points
    .map((p) => ({ ...p, distance: Math.round(distanceMeters(center, p)) }))
    .sort((a, b) => a.distance - b.distance);
  return {
    inRadius: sorted.filter((p) => p.distance <= radius),
    nearest: sorted.filter((p) => p.distance > radius).slice(0, NEAREST_OUTSIDE),
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

/** Обменники с координатами вокруг точки (прямоугольник ~20 км), с курсами, склеенными по правилу 2. */
export async function loadNearby(
  db: ReturnType<typeof getDb>,
  center: { lat: number; lng: number },
  radius: number,
): Promise<{ inRadius: ExchangerOut[]; nearest: ExchangerOut[] }> {
  const dLat = SEARCH_RADIUS_M / 111_195;
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
  return splitByRadius(points, center, radius);
}
