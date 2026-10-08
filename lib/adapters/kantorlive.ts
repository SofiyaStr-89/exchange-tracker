// Адаптер kantor.live (Польша): внутренний JSON режима «Na mapie», один запрос на город.
// Особенности источника — в recon/REPORT.md и SPEC.md (таблица источников).

import type { WeekHours } from '../db/schema.js';
import { distanceMeters } from '../geo.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { normalizeRate, safeWebsite, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'kantorlive';

interface KlRate {
  currency: string;
  base_currency: string;
  amount: number;
  buy: string | null;
  sell: string | null;
  updated_at: string | null;
}

interface KlKantor {
  name: Record<string, string>;
  slug: string;
  address: Record<string, string>;
  lat: number | null;
  lon: number | null;
  schedule: { day: string; begin: string; end: string }[] | null;
  phones?: string[] | null;
  site?: string | null;
  /** Пустой массив, когда свежих курсов нет. */
  rates: { retail: Record<string, KlRate> | unknown[] };
}

interface KlResponse {
  data: {
    city: { name: string; slug: string; translations?: Record<string, string>; coordinates?: { lat: number; lon: number } };
    kantors: KlKantor[];
  };
}

const DAYS: Record<string, keyof WeekHours> = {
  mo: 'mon',
  tu: 'tue',
  we: 'wed',
  th: 'thu',
  fr: 'fri',
  sa: 'sat',
  su: 'sun',
};

const hhmm = (time: string) => time.slice(0, 5);

/** Координаты дальше этого от центра города считаем ошибкой источника (у одного варшавского kantoru были вроцлавские). */
const MAX_DISTANCE_FROM_CITY_M = 40_000;

function parseHours(schedule: KlKantor['schedule']): WeekHours | null {
  if (!schedule?.length) return null;
  const hours: WeekHours = {};
  for (const { day, begin, end } of schedule) {
    const key = DAYS[day];
    if (!key) continue;
    const [b, e] = [hhmm(begin), hhmm(end)];
    if (b === '00:01' && e === '00:02') hours[key] = null; // так kantor.live кодирует выходной
    else hours[key] = [b, e === '23:59' ? '24:00' : e];
  }
  return hours;
}

function slugNumber(slug: string): string {
  const m = slug.match(/^(\d+)-/);
  if (!m) throw new Error(`kantor.live: нет номера в slug «${slug}»`);
  return m[1]!;
}

export function parseKantorLive(json: KlResponse, citySlug: string): AdapterResult {
  const cityName = json.data.city.translations?.pl ?? json.data.city.name;
  const center = json.data.city.coordinates;
  const exchangers: NormalizedExchanger[] = [];
  const rates: NormalizedRate[] = [];

  for (const k of json.data.kantors) {
    const number = slugNumber(k.slug);
    const id = `pl-${citySlug}-${SOURCE}-${number}`;
    const hasCoords =
      typeof k.lat === 'number' &&
      typeof k.lon === 'number' &&
      k.lat !== 0 &&
      k.lon !== 0 &&
      (!center || distanceMeters({ lat: k.lat, lng: k.lon }, { lat: center.lat, lng: center.lon }) <= MAX_DISTANCE_FROM_CITY_M);
    exchangers.push({
      id,
      country: 'PL',
      city: cityName,
      name: k.name.pl ?? Object.values(k.name)[0] ?? '',
      bank: null,
      address: k.address.pl ?? Object.values(k.address)[0] ?? '',
      lat: hasCoords ? k.lat : null,
      lng: hasCoords ? k.lon : null,
      coordsSource: hasCoords ? 'source' : null,
      hours: parseHours(k.schedule),
      sourceIds: { [SOURCE]: number },
      phone: k.phones?.find((p) => p.trim())?.trim() ?? null,
      website: safeWebsite(k.site),
    });

    if (Array.isArray(k.rates.retail)) continue; // свежих курсов нет
    for (const r of Object.values(k.rates.retail)) {
      if (r.base_currency !== 'PLN') continue;
      const buy = normalizeRate(r.buy, r.amount);
      const sell = normalizeRate(r.sell, r.amount);
      if (buy === null && sell === null) continue;
      rates.push({
        exchangerId: id,
        currency: r.currency,
        buy,
        sell,
        // Помечено «+00:00», но на деле это варшавское время (шаг 1, recon/REPORT.md).
        rateUpdatedAt: r.updated_at ? zonedWallTimeToUtc(r.updated_at, 'Europe/Warsaw') : null,
        source: SOURCE,
      });
    }
  }
  return { exchangers, rates };
}

export async function fetchKantorLive(citySlug: string): Promise<AdapterResult> {
  const url = `https://kantor.live/api/v1/kantors?city=${encodeURIComponent(citySlug)}&per_page=1000&locale=pl`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`kantor.live: HTTP ${response.status}`);
  const json = (await response.json()) as KlResponse;
  if (!Array.isArray(json?.data?.kantors)) throw new Error('kantor.live: в ответе нет списка kantors');
  return parseKantorLive(json, citySlug);
}
