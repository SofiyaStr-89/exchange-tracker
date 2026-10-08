// Адаптер marketportal.pl (Польша): страницы курса одной валюты по городу,
// /kantory/kursy-walut/<город>/<валюта>. На каждой — розничная и оптовая вкладки; у kantoru координаты,
// адрес, телефон, часы, сайт и время последнего сбора курсов самим marketportal (время Варшавы).
// marketportal сам забирает курсы с сайтов kantorów — это время его сбора, а не смены курса в kantorze.

import type { WeekHours } from '../db/schema.js';
import { decodeEntities, textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import {
  isCryptoName,
  normalizeRate,
  safeWebsite,
  type AdapterResult,
  type NormalizedExchanger,
  type NormalizedRate,
} from './types.js';

export const SOURCE = 'marketportal';
/** marketportal обновляет город целиком; чаще 30 минут ходить незачем (SPEC: «Вежливость»). */
export const MAX_AGE_MS = 30 * 60 * 1000;
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];
const PAUSE_MS = 1500;

const DAYS: Record<string, keyof WeekHours> = {
  poniedziałek: 'mon',
  wtorek: 'tue',
  środa: 'wed',
  czwartek: 'thu',
  piątek: 'fri',
  sobota: 'sat',
  niedziela: 'sun',
};

const num = (s: string) => Number.parseFloat(s.replace(',', '.'));
const pad = (t: string) => t.padStart(5, '0');

function parseHours(row: string): WeekHours | null {
  const hours: WeekHours = {};
  for (const m of row.matchAll(/<li[^>]*>\s*([A-Za-zżźćńółęąśŻŹĆŃÓŁĘĄŚ]+)\s*<span>([^<]*)<\/span>/g)) {
    const day = DAYS[m[1]!.toLowerCase()];
    if (!day) continue;
    const value = m[2]!.trim();
    const t = value.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (t) hours[day] = [pad(t[1]!), pad(t[2]!)];
    else if (/zamkni/i.test(value)) hours[day] = null;
  }
  return Object.keys(hours).length ? hours : null;
}

interface Row {
  exchanger: NormalizedExchanger;
  buy: number | null;
  sell: number | null;
  updatedAt: Date | null;
  wholesale: boolean;
}

function parseRow(row: string, citySlug: string, wholesale: boolean): Row | null {
  const head = row.match(/^<tr><td><a href="\/kantor\/[^"]+">([^<]*)<\/a><\/td><td>([^<]*)<\/td><td>([^<]*)<\/td>/);
  const eoid = row.match(/data-eoid="(\d+)"/)?.[1];
  const lat = num(row.match(/data-lat="([^"]+)"/)?.[1] ?? '');
  const lng = num(row.match(/data-lng="([^"]+)"/)?.[1] ?? '');
  if (!head || !eoid) return null;
  const name = textOf(head[1]!);
  if (isCryptoName(name)) return null;

  const [district = '', street = ''] = textOf(row.match(/id="hAddress_\d+">([^<]*)</)?.[1] ?? '').split('#');
  const city = district.split(' - ')[0]!.trim();
  const phone = row.match(/<li>Telefon:\s*([^<]+)<\/li>/)?.[1]?.trim() ?? null;
  const website = row.match(/<a href="([^"]+)"[^>]*>Strona internetowa kantoru<\/a>/)?.[1];
  const stamp = row.match(/Ostatnia aktualizacja kursów<\/b>:\s*<\/p>\s*<span>([^<]+)<\/span>/)?.[1]?.trim();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;

  return {
    exchanger: {
      id: `pl-${citySlug}-${SOURCE}-${eoid}`,
      country: 'PL',
      city,
      name,
      bank: null,
      address: street ? `${street.trim()}, ${city}` : '',
      lat: hasCoords ? lat : null,
      lng: hasCoords ? lng : null,
      coordsSource: hasCoords ? 'source' : null,
      hours: parseHours(row),
      sourceIds: { [SOURCE]: eoid },
      phone,
      website: safeWebsite(website ? decodeEntities(website) : null),
    },
    buy: normalizeRate(head[2]!.trim()),
    sell: normalizeRate(head[3]!.trim()),
    updatedAt: stamp ? zonedWallTimeToUtc(stamp.replace(' ', 'T'), 'Europe/Warsaw') : null,
    wholesale,
  };
}

const hasRate = (r: Row) => r.buy !== null || r.sell !== null;

/** Одна страница валюты: обменники и курсы по этой валюте (розничный главнее оптового). */
export function parseMarketportalPage(html: string, currency: string, citySlug: string): AdapterResult {
  const wholesaleStart = html.indexOf('id="wholesale-quotes"');
  const byId = new Map<string, Row[]>();
  for (const m of html.matchAll(/<tr><td><a href="\/kantor\/[\s\S]*?<\/tr>/g)) {
    const row = parseRow(m[0], citySlug, wholesaleStart >= 0 && m.index > wholesaleStart);
    if (row) byId.set(row.exchanger.id, [...(byId.get(row.exchanger.id) ?? []), row]);
  }

  const exchangers: NormalizedExchanger[] = [];
  const rates: NormalizedRate[] = [];
  for (const rows of byId.values()) {
    // Розничные строки раньше оптовых: и для курса, и для контактов.
    rows.sort((a, b) => Number(a.wholesale) - Number(b.wholesale));
    const first = rows[0]!.exchanger;
    exchangers.push({
      ...first,
      hours: rows.find((r) => r.exchanger.hours)?.exchanger.hours ?? null,
      phone: rows.find((r) => r.exchanger.phone)?.exchanger.phone ?? null,
      website: rows.find((r) => r.exchanger.website)?.exchanger.website ?? null,
    });
    const rated = rows.find(hasRate);
    if (rated) {
      rates.push({ exchangerId: first.id, currency, buy: rated.buy, sell: rated.sell, rateUpdatedAt: rated.updatedAt, source: SOURCE });
    }
  }
  return { exchangers, rates };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchMarketportal(citySlug: string): Promise<AdapterResult> {
  const exchangers = new Map<string, NormalizedExchanger>();
  const rates: NormalizedRate[] = [];
  for (const [i, currency] of CURRENCIES.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    const url = `https://marketportal.pl/kantory/kursy-walut/${encodeURIComponent(citySlug)}/${currency.toLowerCase()}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`marketportal ${currency}: HTTP ${response.status}`);
    const page = parseMarketportalPage(await response.text(), currency, citySlug);
    for (const e of page.exchangers) exchangers.set(e.id, { ...exchangers.get(e.id), ...e, hours: e.hours ?? exchangers.get(e.id)?.hours ?? null });
    rates.push(...page.rates);
  }
  if (!exchangers.size) throw new Error('marketportal: на страницах нет ни одного kantoru — сменилась вёрстка?');
  return { exchangers: [...exchangers.values()], rates };
}
