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
  distance: number;
  hours: WeekHours | null;
  phone: string | null;
  website: string | null;
  sources: string[];
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
