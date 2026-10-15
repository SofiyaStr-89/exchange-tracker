// Выдача обменников в видимой области карты (SPEC: «API», FR-3, FR-9, правило склейки 2).

import { and, between, eq, inArray, isNotNull, or, type SQL } from 'drizzle-orm';
import type { getDb } from './db/index.js';
import { exchangers, goldPrices, rates, type WeekHours } from './db/schema.js';
import { goldOwners } from './gold.js';
import { boundsCenter, inside, type Bounds } from './bounds.js';
import { distanceMeters } from './geo.js';
import { mergeDuplicates } from './merge.js';
import { OFFICIAL_SOURCES } from './sources.js';

export { boundsSize, MAX_SIDE_M, type Bounds } from './bounds.js';

export const FRESH_MS = 15 * 60 * 1000;
const NEAREST_OUTSIDE = 3;
/** Насколько далеко от центра области искать ближайшие за её пределами (FR-9). */
const NEAREST_MAX_M = 20_000;

export function isStale(fetchedAt: Date | null, now = new Date(), maxAgeMs = FRESH_MS): boolean {
  return !fetchedAt || now.getTime() - fetchedAt.getTime() > maxAgeMs;
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
  phone: string | null;
  website: string | null;
  /** Источники, из которых склеен обменник (правило склейки 1). */
  sources: string[];
  memberIds: string[];
  rates: Record<string, Omit<RateRow, 'currency'>>;
}

type Db = ReturnType<typeof getDb>;
type Point = Omit<ExchangerOut, 'distance'>;

/** Обменники с координатами по условию — с курсами, склеенными по источникам (правило склейки 2). */
async function loadPoints(db: Db, where: SQL | undefined): Promise<Point[]> {
  const rows = await db
    .select({ e: exchangers, r: rates })
    .from(exchangers)
    .leftJoin(rates, eq(rates.exchangerId, exchangers.id))
    .where(and(isNotNull(exchangers.lat), where));

  const byId = new Map<string, { e: (typeof rows)[number]['e']; rates: RateRow[] }>();
  for (const { e, r } of rows) {
    const item = byId.get(e.id) ?? { e, rates: [] };
    if (r) {
      item.rates.push({
        currency: r.currency,
        buy: r.buy,
        sell: r.sell,
        // Сайт без времени обновления: курс стареет с момента, когда значение появилось (правило склейки 6).
        rateUpdatedAt: r.rateUpdatedAt ?? (r.source === 'site' ? r.fetchedAt : null),
        confirmedAt: r.confirmedAt,
        source: r.source,
      });
    }
    byId.set(e.id, item);
  }

  return [...byId.values()].map(({ e, rates: list }) => {
    const merged = mergeRates(list);
    return {
      id: e.id,
      country: e.country,
      city: e.city,
      name: e.name,
      bank: e.bank,
      address: e.address,
      lat: e.lat!,
      lng: e.lng!,
      hours: e.hours,
      phone: e.phone,
      website: e.website,
      sources: Object.keys(e.sourceIds),
      memberIds: [e.id],
      rates: Object.fromEntries(Object.entries(merged).map(([cur, { currency: _, ...rest }]) => [cur, rest])),
    };
  });
}

const near = (p: { lat: number; lng: number }, meters: number): SQL => {
  const dLat = meters / 111_195;
  const dLng = dLat / Math.cos((p.lat * Math.PI) / 180);
  return and(between(exchangers.lat, p.lat - dLat, p.lat + dLat), between(exchangers.lng, p.lng - dLng, p.lng + dLng))!;
};

/** Обменники в области и ближайшие к ней (FR-9), с курсами, склеенными по правилу 2. */
export async function loadInBounds(
  db: Db,
  bounds: Bounds,
  currency: string,
): Promise<{ inView: ExchangerOut[]; nearest: ExchangerOut[] }> {
  const points = await loadPoints(db, near(boundsCenter(bounds), NEAREST_MAX_M));
  return splitByBounds(mergeDuplicates(points), bounds, (e) => Boolean(e.rates[currency]));
}

/** Склеиваемые дубли лежат не дальше этого — соседей берём с запасом, чтобы склейка совпала с картой. */
const MERGE_RADIUS_M = 300;

/**
 * Избранные обменники по id (FR-34): вместе с соседями, чтобы склеить так же, как на карте,
 * и найти обменник, даже если его основной id в группе склейки сменился.
 */
export async function loadByIds(db: Db, ids: string[]): Promise<Point[]> {
  if (!ids.length) return [];
  const found = await db
    .select({ lat: exchangers.lat, lng: exchangers.lng })
    .from(exchangers)
    .where(and(inArray(exchangers.id, ids), isNotNull(exchangers.lat)));
  if (!found.length) return [];
  const points = await loadPoints(db, or(...found.map((p) => near({ lat: p.lat!, lng: p.lng! }, MERGE_RADIUS_M))));
  const wanted = new Set(ids);
  return mergeDuplicates(points).filter((e) => e.memberIds.some((id) => wanted.has(id)));
}

export interface GoldOut {
  kind: 'purity' | 'bar';
  item: string;
  buy: number | null;
  sell: number | null;
  priceUpdatedAt: Date | null;
  source: string;
}

/** Цены золота для обменников — словарь «владелец → цены» (банк Беларуси — один раз, а не на каждое отделение). */
export async function loadGold(db: Db, points: { country: string; bank: string | null; memberIds?: string[]; id: string }[]): Promise<Record<string, GoldOut[]>> {
  const owners = [...new Set(points.flatMap(goldOwners))];
  if (!owners.length) return {};
  const rows = await db.select().from(goldPrices).where(inArray(goldPrices.owner, owners));
  const out: Record<string, GoldOut[]> = {};
  for (const r of rows) {
    (out[r.owner] ??= []).push({ kind: r.kind, item: r.item, buy: r.buy, sell: r.sell, priceUpdatedAt: r.priceUpdatedAt, source: r.source });
  }
  for (const list of Object.values(out)) list.sort((a, b) => Number(b.item) - Number(a.item) || 0);
  return out;
}
