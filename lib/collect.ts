// Сбор одного города одним адаптером: блокировка → запрос к источнику → запись → отметка в city_fetches.

import { fetchKantorLive, SOURCE as KANTORLIVE } from './adapters/kantorlive.js';
import type { AdapterResult, Country } from './adapters/types.js';
import type { getDb } from './db/index.js';
import { finishCityFetch, saveResult, startCityFetch } from './store.js';

interface Adapter {
  country: Country;
  fetchCity: (city: string) => Promise<AdapterResult>;
}

export const ADAPTERS: Record<string, Adapter> = {
  [KANTORLIVE]: { country: 'PL', fetchCity: fetchKantorLive },
};

export type CollectOutcome =
  | { status: 'ok'; exchangers: number; rates: number }
  | { status: 'busy' }
  | { status: 'error'; error: string };

export async function collectCity(db: ReturnType<typeof getDb>, source: string, city: string): Promise<CollectOutcome> {
  const adapter = ADAPTERS[source];
  if (!adapter) throw new Error(`Неизвестный источник «${source}»`);
  if (!(await startCityFetch(db, source, adapter.country, city))) return { status: 'busy' };
  try {
    const result = await adapter.fetchCity(city);
    await saveResult(db, result);
    await finishCityFetch(db, source, adapter.country, city, null);
    return { status: 'ok', exchangers: result.exchangers.length, rates: result.rates.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await finishCityFetch(db, source, adapter.country, city, error);
    return { status: 'error', error };
  }
}
