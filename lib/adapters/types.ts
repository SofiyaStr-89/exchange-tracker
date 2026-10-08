// Общая модель, к которой каждый адаптер приводит свой источник (SPEC: «Источники данных и правила склейки»).

import type { WeekHours } from '../db/schema.js';

export type Country = 'PL' | 'BY';

export interface NormalizedExchanger {
  id: string;
  country: Country;
  city: string;
  name: string;
  bank: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  coordsSource: 'source' | 'osm' | 'geocoder' | null;
  /** null — часы неизвестны (FR-22). */
  hours: WeekHours | null;
  sourceIds: Record<string, string>;
}

export interface NormalizedRate {
  exchangerId: string;
  currency: string;
  /** Обменник покупает, местная валюта за 1 единицу; null — этой стороны нет. */
  buy: number | null;
  /** Обменник продаёт. */
  sell: number | null;
  rateUpdatedAt: Date | null;
  source: string;
}

export interface AdapterResult {
  exchangers: NormalizedExchanger[];
  rates: NormalizedRate[];
}

/** Курс источника за `amount` единиц → за 1 единицу; 0, пусто и мусор → null (правила склейки 4 и 5). */
export function normalizeRate(raw: string | number | null | undefined, amount = 1): number | null {
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || !(amount > 0)) return null;
  return Math.round((value / amount) * 1e8) / 1e8;
}
