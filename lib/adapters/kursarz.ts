// Адаптер kursarz.pl (Польша): таблица «Kursy walut w kantorach» по валюте и городу,
// /kantory/kursy-walut.html?filter_val=<валюта>&filter_city=<город>&limit=0 — все kantory города с курсом
// этой валюты в одной таблице. У строки: id kantoru, курс за 1 или 100 единиц, время курса (Варшава),
// название, улица, индекс, город и район. Координат нет — точки геокодируются (`npm run geocode`).
// Kantory сами вносят курсы на kursarz; регламент сайта автоматическое чтение не запрещает (проверено 13.10.2026).

import { textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { isCryptoName, normalizeRate, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'kursarz';
/** Город целиком — 4 страницы; чаще 30 минут ходить незачем (SPEC: «Вежливость»). */
export const MAX_AGE_MS = 30 * 60 * 1000;
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF'];
const PAUSE_MS = 1500;

const cells = (row: string) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!);
const paragraphs = (cell: string) => [...cell.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]!);

/** Одна страница валюты. Сайт ищет город по подстроке («Stara Warszawa») — берём только точное совпадение. */
export function parseKursarzPage(html: string, currency: string, cityName: string, cityId: string): AdapterResult {
  const exchangers: NormalizedExchanger[] = [];
  const rates: NormalizedRate[] = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = m[1]!;
    const link = row.match(/href="\/kantory\/wizytowka\/(\d+)-[^"]*"\s*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const td = cells(row);
    const unit = textOf(td[0] ?? '').match(/^(\d+)\s*([A-Z]{3})$/);
    if (!unit || unit[2] !== currency || td.length < 8) continue;
    const [, streetP = '', placeP = ''] = paragraphs(td[7]!);
    const cityPart = textOf(placeP).split(',')[0]!.trim(); // после запятой — район
    // «00-566 Warszawa» или просто «Warszawa»
    const place = cityPart.match(/^(\d{2}-\d{3})?\s*(.+)$/);
    const postcode = place?.[1] ?? '';
    const city = place?.[2]?.trim() ?? '';
    if (city.toLowerCase() !== cityName.toLowerCase()) continue;

    const name = textOf(link[2]!);
    const street = textOf(streetP);
    if (!street || isCryptoName(name)) continue; // без адреса — интернет-kantor, на карту не годится

    const amount = Number.parseInt(unit[1]!, 10);
    const buy = normalizeRate(textOf(td[1]!), amount);
    const sell = normalizeRate(textOf(td[2]!), amount);
    const stamp = textOf(td[6]!).match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d)$/);
    const id = `${cityId}-${SOURCE}-${link[1]}`;
    exchangers.push({
      id,
      country: 'PL',
      city,
      name,
      bank: null,
      address: [street, `${postcode} ${city}`.trim()].join(', '),
      lat: null,
      lng: null,
      coordsSource: null,
      hours: null,
      sourceIds: { [SOURCE]: link[1]! },
      phone: null,
      website: null,
    });
    if (buy !== null || sell !== null) {
      rates.push({
        exchangerId: id,
        currency,
        buy,
        sell,
        rateUpdatedAt: stamp ? zonedWallTimeToUtc(`${stamp[1]}T${stamp[2]}`, 'Europe/Warsaw') : null,
        source: SOURCE,
      });
    }
  }
  return { exchangers, rates };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchKursarz(cityName: string, cityId: string): Promise<AdapterResult> {
  const exchangers = new Map<string, NormalizedExchanger>();
  const rates: NormalizedRate[] = [];
  for (const [i, currency] of CURRENCIES.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    const url = `https://kursarz.pl/kantory/kursy-walut.html?filter_val=${currency}&filter_city=${encodeURIComponent(cityName)}&limit=0`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`kursarz ${currency}: HTTP ${response.status}`);
    const html = await response.text();
    if (!html.includes('filter_val')) throw new Error('kursarz: нет таблицы курсов — сменилась вёрстка?');
    const page = parseKursarzPage(html, currency, cityName, cityId);
    for (const e of page.exchangers) exchangers.set(e.id, e);
    rates.push(...page.rates);
  }
  // Пустой город — нормально: kursarz есть не во всех городах из списка marketportal.
  return { exchangers: [...exchangers.values()], rates };
}
