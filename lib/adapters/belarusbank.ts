// Адаптер API Беларусбанка (официальный, приоритетный для своего банка, SPEC «Источники»):
// kursExchange?city=… — курсы по отделениям, адрес, часы; filials_info?city=… — координаты (GPS_X — широта).
// Курсы даны за официальный масштаб НБРБ (RUB за 100, PLN за 10…) — приводим к 1 единице (правило 5).

import { and, eq, isNotNull, like } from 'drizzle-orm';
import type { getDb } from '../db/index.js';
import { exchangers, type WeekHours } from '../db/schema.js';
import { loadNbrb } from '../nbrb.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { normalizeRate, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'belarusbank';
const BANK = 'Беларусбанк';
const API = 'https://belarusbank.by/api';

type KursRow = Record<string, string>;
interface Filial {
  filial_id: string;
  GPS_X?: string;
  GPS_Y?: string;
}

const DAYS: Record<string, keyof WeekHours> = { Пн: 'mon', Вт: 'tue', Ср: 'wed', Чт: 'thu', Пт: 'fri', Сб: 'sat', Вс: 'sun' };

/** «|Пн 10 00 19 00    |…|Сб      |» → часы по дням; пустая строка — часы неизвестны. */
function parseWorktime(text: string | undefined): WeekHours | null {
  const hours: WeekHours = {};
  for (const part of (text ?? '').split('|')) {
    const m = part.trim().match(/^(Пн|Вт|Ср|Чт|Пт|Сб|Вс)(?:\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\d{2}))?$/);
    if (!m) continue;
    hours[DAYS[m[1]!]!] = m[2] ? [`${m[2]}:${m[3]}`, m[4] === '23' && m[5] === '59' ? '24:00' : `${m[4]}:${m[5]}`] : null;
  }
  return Object.keys(hours).length ? hours : null;
}

export function parseBelarusbank(
  kurs: KursRow[],
  filials: Filial[] | null,
  scales: Record<string, number>,
  citySlug: string,
): AdapterResult {
  const coords = new Map((filials ?? []).map((f) => [f.filial_id, f]));
  const result: AdapterResult = { exchangers: [], rates: [] };
  for (const row of kurs) {
    const id = `by-${citySlug}-${SOURCE}-${row.filial_id}`;
    const gps = coords.get(row.filial_id!);
    const lat = Number(gps?.GPS_X);
    const lng = Number(gps?.GPS_Y);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && gps !== undefined;
    const street = `${row.street_type ?? ''}${row.street ?? ''}`.replace(/\s+/g, ' ').trim();
    const exchanger: NormalizedExchanger = {
      id,
      country: 'BY',
      city: row.name ?? '',
      name: row.filials_text ?? BANK,
      bank: BANK,
      address: [street, row.home_number, row.name].filter(Boolean).join(', '),
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      coordsSource: hasCoords ? 'source' : null,
      hours: parseWorktime(row.info_worktime),
      sourceIds: { [SOURCE]: row.filial_id! },
      phone: null,
      website: 'https://belarusbank.by',
    };
    result.exchangers.push(exchanger);

    const updatedAt = row.kurs_date_time ? zonedWallTimeToUtc(row.kurs_date_time, 'Europe/Minsk') : null;
    for (const key of Object.keys(row)) {
      const currency = key.match(/^([A-Z]{3})_in$/)?.[1]; // кросс-курсы вида USD_EUR_in пропускаются
      if (!currency) continue;
      const scale = scales[currency] ?? 1;
      const buy = normalizeRate(row[`${currency}_in`], scale);
      const sell = normalizeRate(row[`${currency}_out`], scale);
      if (buy === null && sell === null) continue;
      result.rates.push({ exchangerId: id, currency, buy, sell, rateUpdatedAt: updatedAt, source: SOURCE } satisfies NormalizedRate);
    }
  }
  return result;
}

async function getJson<T>(path: string, city: string): Promise<T> {
  const res = await fetch(`${API}/${path}?city=${encodeURIComponent(city)}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Беларусбанк ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** cityName — как город называется в API («Минск»), citySlug — для id («minsk»). */
export async function fetchBelarusbank(cityName: string, citySlug: string, db: ReturnType<typeof getDb>): Promise<AdapterResult> {
  const kurs = await getJson<KursRow[]>('kursExchange', cityName);
  if (!Array.isArray(kurs) || !kurs.length) throw new Error('Беларусбанк: пустой ответ kursExchange');
  // Координаты меняются редко: второй (тяжёлый) запрос — только если у части отделений их ещё нет.
  const known = await db
    .select({ id: exchangers.id })
    .from(exchangers)
    .where(and(like(exchangers.id, `by-${citySlug}-${SOURCE}-%`), isNotNull(exchangers.lat), eq(exchangers.country, 'BY')));
  const knownIds = new Set(known.map((k) => k.id));
  const missing = kurs.some((r) => !knownIds.has(`by-${citySlug}-${SOURCE}-${r.filial_id}`));
  const filials = missing ? await getJson<Filial[]>('filials_info', cityName) : null;
  const { scales } = await loadNbrb();
  return parseBelarusbank(kurs, filials, scales, citySlug);
}
