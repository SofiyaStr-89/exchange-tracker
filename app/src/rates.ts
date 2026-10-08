// Какой курс показывать на плашке и какой лучший (FR-12, FR-15, FR-16, FR-23, FR-24).

import { OFFICIAL_SOURCES } from '../../lib/sources.js';

export type Mode = 'buy' | 'sell'; // с точки зрения пользователя: «Покупаю» / «Продаю»

export interface ApiRate {
  buy: number | null;
  sell: number | null;
  rateUpdatedAt: string | null;
  confirmedAt: string;
  source: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Покупаю» — пользователь платит курс продажи обменника, «Продаю» — получает курс покупки. */
export function rateFor(e: { rates: Record<string, ApiRate> }, currency: string, mode: Mode): number | null {
  const r = e.rates[currency];
  if (!r) return null;
  return (mode === 'buy' ? r.sell : r.buy) ?? null;
}

/** Возраст курса; у официальных API банков — от последнего подтверждения (правило склейки 6). */
export function rateAgeMs(r: ApiRate, now = new Date()): number {
  const at = OFFICIAL_SOURCES.includes(r.source) ? r.confirmedAt : (r.rateUpdatedAt ?? r.confirmedAt);
  return now.getTime() - Date.parse(at);
}

export const isFresh = (r: ApiRate, now = new Date()) => rateAgeMs(r, now) <= DAY_MS;

/** Лучший курс среди открытых со свежим курсом; при равенстве — все с этим курсом. */
export function bestIds(
  list: { id: string; open: boolean; rates: Record<string, ApiRate> }[],
  currency: string,
  mode: Mode,
  now = new Date(),
): Set<string> {
  const candidates = list
    .filter((e) => e.open && e.rates[currency] && isFresh(e.rates[currency]!, now))
    .map((e) => ({ id: e.id, value: rateFor(e, currency, mode) }))
    .filter((c): c is { id: string; value: number } => c.value !== null);
  if (!candidates.length) return new Set();
  const values = candidates.map((c) => c.value);
  const target = mode === 'buy' ? Math.min(...values) : Math.max(...values);
  return new Set(candidates.filter((c) => c.value === target).map((c) => c.id));
}
