// Адаптер kantorsprawa.pl (Kantor Sprawa): одна страница на город, курсы общие для всех точек города.
// Курсы с «Aktualizacja: …» (время Варшавы), адреса и часы точек — в блоке контактов внизу.

import type { WeekHours } from '../db/schema.js';
import { textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { normalizeRate, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'sprawa';
const BASE = 'https://kantorsprawa.pl';
const ORDER: (keyof WeekHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const PL_DAYS = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];

const ROW =
  /<span class="curr_symbol">([A-Z]{3})<\/span><\/td>\s*<td class="tdc kraj">([^<]*)<\/td>[\s\S]*?id="\1_dk" class="kurs">([\d.]*)<\/span>[\s\S]*?id="\1_ds" class="kurs">([\d.]*)<\/span>/g;

/** «poniedziałek - sobota 09:00 - 21:00» → часы по дням; дни вне диапазона — выходные. */
export function parsePolishHours(text: string): WeekHours | null {
  const m = text.toLowerCase().match(/([a-ząćęłńóśźż]+)\s*-\s*([a-ząćęłńóśźż]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!m) return null;
  const [from, to] = [PL_DAYS.indexOf(m[1]!), PL_DAYS.indexOf(m[2]!)];
  if (from < 0 || to < 0) return null;
  const hours: WeekHours = {};
  ORDER.forEach((day, i) => {
    hours[day] = i >= from && i <= to ? [m[3]!.padStart(5, '0'), m[4]!.padStart(5, '0')] : null;
  });
  return hours;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function parseSprawa(html: string, citySlug: string): AdapterResult {
  const contact = html.match(/<div class="kontakt-box2">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const lines = [...contact.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => textOf(m[1]!)).filter(Boolean);
  const phone = lines.find((l) => /^\+?\d[\d\s]{6,}$/.test(l)) ?? null;

  const exchangers: NormalizedExchanger[] = [];
  lines.forEach((line, i) => {
    const address = line.match(/^(.+?),\s*(\d{2}-\d{3})\s+(.+)$/);
    if (!address) return;
    exchangers.push({
      id: `pl-${citySlug}-${SOURCE}-${slug(address[1]!)}`,
      country: 'PL',
      city: address[3]!,
      name: 'Kantor Sprawa',
      bank: null,
      address: line,
      lat: null,
      lng: null,
      coordsSource: null,
      hours: parsePolishHours(lines[i + 1] ?? ''),
      sourceIds: { [SOURCE]: slug(address[1]!) },
      phone,
      website: `${BASE}/${citySlug}`,
    });
  });

  const stamp = html.match(/class="max_time">([^<]+)</)?.[1]?.trim();
  const updatedAt = stamp ? zonedWallTimeToUtc(stamp, 'Europe/Warsaw') : null;
  const rates: NormalizedRate[] = [];
  for (const m of html.matchAll(ROW)) {
    // «NEW» (новые купюры USD), «EUB»/«GBB» (монеты) — не основной курс.
    if (/bilon|nowe/i.test(m[2]!)) continue;
    const buy = normalizeRate(m[3]);
    const sell = normalizeRate(m[4]);
    if (buy === null && sell === null) continue;
    for (const e of exchangers) rates.push({ exchangerId: e.id, currency: m[1]!, buy, sell, rateUpdatedAt: updatedAt, source: SOURCE });
  }
  return { exchangers, rates };
}

export async function fetchSprawa(citySlug: string): Promise<AdapterResult> {
  const response = await fetch(`${BASE}/${encodeURIComponent(citySlug)}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`kantorsprawa.pl: HTTP ${response.status}`);
  const result = parseSprawa(await response.text(), citySlug);
  if (!result.exchangers.length) throw new Error('kantorsprawa.pl: не нашла адресов точек — сменилась вёрстка?');
  return result;
}
