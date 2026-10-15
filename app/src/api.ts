// Запросы к своему API. Координаты — в теле POST, не в адресе (SPEC: «Приватность»).

import type { Bounds } from '../../lib/bounds.js';
import type { WeekHours } from '../../lib/db/schema.js';
import type { ApiRate } from './rates.js';

export interface ApiExchanger {
  id: string;
  country: 'PL' | 'BY';
  city: string;
  name: string;
  bank: string | null;
  address: string;
  lat: number;
  lng: number;
  /** Только в выдаче карты: расстояние от центра области. */
  distance?: number;
  hours: WeekHours | null;
  phone: string | null;
  website: string | null;
  sources: string[];
  /** id всех записей, из которых склеен обменник (для избранного). */
  memberIds: string[];
  rates: Record<string, ApiRate>;
}

export interface ExchangersResponse {
  refreshing: boolean;
  dataFetchedAt: string | null;
  exchangers: ApiExchanger[];
  nearest: ApiExchanger[];
}

export async function fetchExchangers(bounds: Bounds, currency: string): Promise<ExchangersResponse> {
  const response = await fetch('/api/exchangers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bounds, currency }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ExchangersResponse;
}

/** Избранное (FR-34): список id — в теле, не в адресе. */
export async function fetchFavorites(ids: string[]): Promise<{ refreshing: boolean; exchangers: ApiExchanger[] }> {
  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as { refreshing: boolean; exchangers: ApiExchanger[] };
}
