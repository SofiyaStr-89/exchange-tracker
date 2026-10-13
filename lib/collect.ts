// Сбор одного города одним адаптером: блокировка → запрос к источнику → запись → отметка в city_fetches.

import { fetchExg, MAX_AGE_MS as EXG_MAX_AGE, SOURCE as EXG } from './adapters/exg.js';
import { fetchKantorLive, SOURCE as KANTORLIVE } from './adapters/kantorlive.js';
import { fetchMyfin, SOURCE as MYFIN } from './adapters/myfin.js';
import { fetchKursarz, MAX_AGE_MS as KURSARZ_MAX_AGE, SOURCE as KURSARZ } from './adapters/kursarz.js';
import { fetchMarketportal, MAX_AGE_MS as MARKETPORTAL_MAX_AGE, SOURCE as MARKETPORTAL } from './adapters/marketportal.js';
import { fetchBelarusbank, SOURCE as BELARUSBANK } from './adapters/belarusbank.js';
import { collectSites, MAX_AGE_MS as SITE_MAX_AGE, SOURCE as SITE } from './adapters/site.js';
import { fetchSprawa, SOURCE as SPRAWA } from './adapters/sprawa.js';
import { fetchOsm, MAX_AGE_MS as OSM_MAX_AGE, SOURCE as OSM } from './adapters/osm.js';
import type { AdapterResult, Country } from './adapters/types.js';
import { CITIES } from './cities.js';
import type { getDb } from './db/index.js';
import { sanitizeRate } from './extract-rates.js';
import { loadNbpMids } from './nbp.js';
import { loadNbrb } from './nbrb.js';
import { finishCityFetch, removeMissing, removeMissingRates, saveResult, startCityFetch } from './store.js';

type Db = ReturnType<typeof getDb>;

interface Adapter {
  country: Country;
  /** Сбор города по его имени в источнике; адаптерам, которым нужна база, передаётся и она. */
  fetchCity: (city: string, db: Db) => Promise<AdapterResult>;
  /** Через сколько данные источника считаются устаревшими; по умолчанию 15 минут. */
  maxAgeMs?: number;
  /** Основной источник: при первом открытии города его ждём, остальные собираются в фоне. */
  primary?: boolean;
}

export const ADAPTERS: Record<string, Adapter> = {
  [KANTORLIVE]: { country: 'PL', fetchCity: fetchKantorLive, primary: true },
  [EXG]: { country: 'PL', fetchCity: fetchExg, maxAgeMs: EXG_MAX_AGE },
  [MARKETPORTAL]: { country: 'PL', fetchCity: fetchMarketportal, maxAgeMs: MARKETPORTAL_MAX_AGE },
  [KURSARZ]: {
    country: 'PL',
    fetchCity: (cityId) => {
      const city = CITIES.find((c) => c.id === cityId);
      if (!city) throw new Error(`Нет города ${cityId}`);
      return fetchKursarz(city.name, city.id);
    },
    maxAgeMs: KURSARZ_MAX_AGE,
  },
  [SPRAWA]: { country: 'PL', fetchCity: fetchSprawa },
  [BELARUSBANK]: {
    country: 'BY',
    fetchCity: (cityId, db) => {
      const city = CITIES.find((c) => c.id === cityId);
      if (!city) throw new Error(`Нет города ${cityId}`);
      return fetchBelarusbank(city.name, city.id.replace(/^by-/, ''), db);
    },
    primary: true,
  },
  [MYFIN]: { country: 'BY', fetchCity: fetchMyfin, primary: true },
  [SITE]: {
    country: 'PL',
    fetchCity: (cityId, db) => {
      const city = CITIES.find((c) => c.id === cityId);
      if (!city) throw new Error(`Нет города ${cityId}`);
      return collectSites(db, city);
    },
    maxAgeMs: SITE_MAX_AGE,
  },
  [OSM]: { country: 'PL', fetchCity: fetchOsm, maxAgeMs: OSM_MAX_AGE },
};

export type CollectOutcome =
  | { status: 'ok'; exchangers: number; rates: number }
  | { status: 'busy' }
  | { status: 'error'; error: string };

/** Правило склейки 7 для любого источника: неправдоподобные курсы не записываем. Польша — NBP, Беларусь — НБРБ. */
async function sanitize(rates: AdapterResult['rates'], country: Country): Promise<AdapterResult['rates']> {
  let mids;
  try {
    mids = country === 'BY' ? (await loadNbrb()).mids : await loadNbpMids();
  } catch {
    return rates; // нацбанк недоступен — сверить не с чем, но и терять курсы незачем
  }
  return rates.flatMap((r) => {
    const clean = sanitizeRate(r.currency, r.buy, r.sell, mids);
    return clean ? [{ ...r, ...clean }] : [];
  });
}

export async function collectCity(db: Db, source: string, city: string): Promise<CollectOutcome> {
  const adapter = ADAPTERS[source];
  if (!adapter) throw new Error(`Неизвестный источник «${source}»`);
  if (!(await startCityFetch(db, source, adapter.country, city))) return { status: 'busy' };
  try {
    const raw = await adapter.fetchCity(city, db);
    const result = { ...raw, rates: await sanitize(raw.rates, adapter.country) };
    await saveResult(db, result);
    await removeMissing(db, result);
    await removeMissingRates(db, source, raw, result.rates);
    await finishCityFetch(db, source, adapter.country, city, null);
    return { status: 'ok', exchangers: result.exchangers.length, rates: result.rates.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await finishCityFetch(db, source, adapter.country, city, error);
    return { status: 'error', error };
  }
}
