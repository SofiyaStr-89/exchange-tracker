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
  phone: string | null;
  /** Только http(s): адрес приходит с чужого сайта и попадает в ссылку. */
  website: string | null;
}

/** Криптоматы и криптообменники — не обмен наличной валюты, на карту не попадают. */
export const isCryptoName = (text: string) => /bitcoin|bitcomat|crypto|kryptowalut|\bbtc\b/i.test(text);

/** Оставляет только http(s)-адрес сайта, иначе null. */
export function safeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
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

export interface NormalizedGold {
  country: Country;
  /** id обменника или `bank:<название банка в нижнем регистре>` */
  owner: string;
  /** purity — цена за 1 г по пробе (kantor); bar — цена мерного слитка по весу (банк) */
  kind: 'purity' | 'bar';
  /** проба («999») или вес слитка в граммах («10») */
  item: string;
  buy: number | null;
  sell: number | null;
  priceUpdatedAt: Date | null;
  source: string;
}

export interface AdapterResult {
  exchangers: NormalizedExchanger[];
  rates: NormalizedRate[];
  /** Цены золота источника: все записи источника с owner, начинающимся с ownerPrefix, заменяются этими. */
  gold?: { ownerPrefix: string; items: NormalizedGold[] };
}

/** Курс источника за `amount` единиц → за 1 единицу; 0, пусто и мусор → null (правила склейки 4 и 5). */
export function normalizeRate(raw: string | number | null | undefined, amount = 1): number | null {
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || !(amount > 0)) return null;
  return Math.round((value / amount) * 1e8) / 1e8;
}
