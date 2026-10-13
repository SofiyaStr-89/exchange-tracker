// Адаптер kantorsprawa.pl (Kantor Sprawa): одна страница на город, курсы общие для всех точек города.
// Новая вёрстка (13.10.2026, Next.js): точки в шапке — «ul. Puławska 2 (poziom -1) - Pon–Sob: 9:00 - 21:00»;
// первый блок курсов — kantor stacjonarny со временем обновления (Варшава), второй — онлайн-обмен (его не берём).
// Индексов и координат нет: точки получают координаты у обменника с тем же адресом (npm run geocode).

import type { WeekHours } from '../db/schema.js';
import { textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { normalizeRate, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'sprawa';
const BASE = 'https://kantorsprawa.pl';
const ORDER: (keyof WeekHours)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHORT_DAYS = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];
const CITY_NAMES: Record<string, string> = { warszawa: 'Warszawa', wroclaw: 'Wrocław', lodz: 'Łódź' };

/** «Pon–Sob», «9:00 - 21:00» → часы по дням; дни вне диапазона — выходные. */
export function parseShortHours(days: string, from: string, to: string): WeekHours | null {
  const [a, b] = days.toLowerCase().split(/[-–]/).map((d) => SHORT_DAYS.indexOf(d.trim()));
  if (a === undefined || b === undefined || a < 0 || b < 0) return null;
  const hours: WeekHours = {};
  ORDER.forEach((day, i) => {
    hours[day] = i >= a && i <= b ? [from.padStart(5, '0'), to.padStart(5, '0')] : null;
  });
  return hours;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const POINT = /((?:ul|al)\.[^<>\n\\]{3,80}?) - (Pon[–-](?:Pt|Sob|Nd)):\s*(\d{1,2}:\d{2}) - (\d{1,2}:\d{2})/g;

/**
 * Строка точек своего города из данных страницы: …\"slug\":\"warszawa\",…\"address\":\"ul. Puławska 2 … - Pon–Sob: …\\nal. …\".
 * В подвале перечислены точки всех городов — берём только свой.
 */
function cityPoints(html: string, citySlug: string): string {
  const at = html.indexOf(`\\"slug\\":\\"${citySlug}\\"`);
  if (at < 0) return '';
  return html.slice(at).match(/\\"address\\":\\"([^"]*?)\\"/)?.[1]?.replace(/\\\\n/g, '\n') ?? '';
}
const ROW =
  /table-body-name__\w+">([A-Z]{3})<span[^>]*>([^<]*)<\/span><\/span><\/div><div[^>]*>([\d.]*)<\/div><div[^>]*>([\d.]*)</g;

export function parseSprawa(html: string, citySlug: string): AdapterResult {
  const city = CITY_NAMES[citySlug] ?? citySlug;
  const phone = html.match(/\+48[\d ]{9,12}\d/)?.[0] ?? null;

  const exchangers: NormalizedExchanger[] = [];
  const seen = new Set<string>();
  for (const m of cityPoints(html, citySlug).matchAll(POINT)) {
    const street = textOf(m[1]!);
    // Id как раньше: без «ul.» и уточнений в скобках («Puławska 2», «al. Jana Pawła II 29»).
    const key = slug(street.replace(/^ul\.\s*/, '').replace(/\([^)]*\)/g, ''));
    if (seen.has(key)) continue;
    seen.add(key);
    exchangers.push({
      id: `pl-${citySlug}-${SOURCE}-${key}`,
      country: 'PL',
      city,
      name: 'Kantor Sprawa',
      bank: null,
      address: `${street}, ${city}`,
      lat: null,
      lng: null,
      coordsSource: null,
      hours: parseShortHours(m[2]!, m[3]!, m[4]!),
      sourceIds: { [SOURCE]: key },
      phone,
      website: `${BASE}/${citySlug}`,
    });
  }

  // Только первый блок — до первой отметки времени: это курсы в kantorze.
  const stampAt = html.search(/panel-timestamp__\w+">/); // элемент, а не одноимённое правило в стилях
  const stationary = stampAt >= 0 ? html.slice(0, stampAt) : '';
  const stamp = html.slice(stampAt).match(/>(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)</)?.[1];
  const updatedAt = stamp ? zonedWallTimeToUtc(stamp.replace(' ', 'T'), 'Europe/Warsaw') : null;
  const rates: NormalizedRate[] = [];
  for (const m of stationary.matchAll(ROW)) {
    // «NEW» (новые купюры USD), монеты (bilon) — не основной курс.
    if (m[1] === 'NEW' || /bilon|od \d{4}/i.test(m[2]!)) continue;
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
  if (!result.exchangers.length || !result.rates.length) throw new Error('kantorsprawa.pl: не нашла точек или курсов — сменилась вёрстка?');
  return result;
}
