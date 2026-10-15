// Золото у kantorów с kursarz.pl: таблица «Kursy metali» по городу, /metale/kursy-metali.html?filter_city=<город>&limit=0.
// Строка: металл, проба, единица («1g»), покупка, продажа, время (Варшава), kantor (id, адрес, город).
// Владелец — тот же id, что у kantoru в адаптере kursarz (`<город>-kursarz-<id>`), — так золото попадает в его карточку.

import { textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import type { AdapterResult, NormalizedGold } from './types.js';

export const SOURCE = 'kursarz-gold';
/** Цены металлов kantory меняют раз-два в день — чаще часа не ходим. */
export const MAX_AGE_MS = 60 * 60 * 1000;

const cells = (row: string) => [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]!);
const price = (cell: string) => {
  const v = Number.parseFloat(textOf(cell).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
};

export function parseKursarzGold(html: string, cityName: string, cityId: string): NormalizedGold[] {
  const items: NormalizedGold[] = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = m[1]!;
    const id = row.match(/\/kantory\/wizytowka\/(\d+)-/)?.[1];
    const td = cells(row);
    if (!id || td.length < 10 || !/^Złoto$/i.test(textOf(td[0]!))) continue;
    const purity = textOf(td[1]!).match(/^\d{3,4}$/)?.[0];
    const grams = Number.parseFloat(textOf(td[2]!).replace(',', '.')); // «1g»
    if (!purity || !(grams > 0)) continue;
    // Город — первая ссылка-фильтр «filter_city=…» (вторая — район).
    const place = td[9]!.match(/<a href="[^"]*filter_city=[^"]*"\s*>([^<]*)<\/a>/)?.[1]?.trim() ?? '';
    if (place.toLowerCase() !== cityName.toLowerCase()) continue; // фильтр сайта ищет подстроку
    const stamp = textOf(td[8]!).match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d)$/);
    const buy = price(td[3]!);
    const sell = price(td[4]!);
    items.push({
      country: 'PL',
      owner: `${cityId}-kursarz-${id}`,
      kind: 'purity',
      item: purity,
      buy: buy === null ? null : buy / grams,
      sell: sell === null ? null : sell / grams,
      priceUpdatedAt: stamp ? zonedWallTimeToUtc(`${stamp[1]}T${stamp[2]}`, 'Europe/Warsaw') : null,
      source: SOURCE,
    });
  }
  return items;
}

export async function fetchKursarzGold(cityName: string, cityId: string): Promise<AdapterResult> {
  const url = `https://kursarz.pl/metale/kursy-metali.html?filter_city=${encodeURIComponent(cityName)}&limit=0`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`kursarz золото: HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes('filter_city')) throw new Error('kursarz золото: нет таблицы — сменилась вёрстка?');
  return { exchangers: [], rates: [], gold: { ownerPrefix: `${cityId}-kursarz-`, items: parseKursarzGold(html, cityName, cityId) } };
}
