// Адаптер exg.pl (сеть kantorów Exchange Group): страница каждого филиала, курсы у филиалов свои.
// /kantory/kantor/<город>/<филиал>: розничные и оптовые курсы, «Dane kursów z: …» (время Варшавы),
// адрес, телефон, часы и ссылки на остальные филиалы города. Координат нет — их находит геокодер.

import type { WeekHours } from '../db/schema.js';
import { textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { normalizeRate, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'exg';
/** 11 страниц на Варшаву — обновляем не чаще раза в час (SPEC: «Вежливость к источникам»). */
export const MAX_AGE_MS = 60 * 60 * 1000;
const BASE = 'https://www.exg.pl/kantory/kantor';
/** С какого филиала начинать: остальные берутся из ссылок на его странице. */
export const SEED_BRANCH: Record<string, string> = { warszawa: 'atrium-targowek' };
const PAUSE_MS = 1500;

const RETAIL_ROW =
  /<b class="rates-name">([A-Z]{3})\s*(?:<small[^>]*>([^<]*)<\/small>)?\s*<\/b><\/div>\s*<div class="td">([\d.,]*)<\/div>\s*<div class="td">([\d.,]*)<\/div>/g;
const WHOLESALE_ROW = /<div class="td">([A-Z]{3})<\/div>\s*<div class="td">([\d.,]*)<\/div>\s*<div class="td">([\d.,]*)<\/div>/g;

const DAY_GROUPS: Record<string, (keyof WeekHours)[]> = {
  'pn-pt': ['mon', 'tue', 'wed', 'thu', 'fri'],
  'pn-sob': ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  'pn-nd': ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  sob: ['sat'],
  nd: ['sun'],
};

function parseHours(block: string): WeekHours | null {
  const hours: WeekHours = {};
  for (const m of block.matchAll(/([a-z-]+):\s*<strong>([^<]*)<\/strong>/g)) {
    const days = DAY_GROUPS[m[1]!];
    if (!days) continue;
    const value = m[2]!.trim();
    const t = value.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    // «(handlowe)» — только в торговые воскресенья, которых в Польше несколько в год.
    const open = t && !/handlowe/i.test(value) ? ([t[1]!.padStart(5, '0'), t[2]!.padStart(5, '0')] as [string, string]) : null;
    for (const d of days) hours[d] = open;
  }
  return Object.keys(hours).length ? hours : null;
}

function stampOf(body: string): Date | null {
  const m = body.match(/Dane kursów z:\s*(\d{4}-\d{2}-\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  return m ? zonedWallTimeToUtc(`${m[1]}T${m[2]!.padStart(5, '0')}`, 'Europe/Warsaw') : null;
}

function packs(html: string): { title: string; body: string }[] {
  return html
    .split('<div class="pack ')
    .slice(1)
    .map((body) => ({ title: textOf(body.match(/class="pack-name">([\s\S]*?)<\/h2>/)?.[1] ?? ''), body }));
}

export interface ExgBranchPage {
  exchanger: NormalizedExchanger;
  rates: NormalizedRate[];
  otherBranches: string[];
}

export function parseExgBranch(html: string, citySlug: string, branch: string): ExgBranchPage {
  const id = `pl-${citySlug}-${SOURCE}-${branch}`;
  const title = textOf(html.match(/<h2 class="main-h"\s*>([\s\S]*?)<\/h2>/)?.[1] ?? branch);
  const [branchName = branch, cityName = 'Warszawa'] = title.split(/\s+-\s+/);

  const addressBlock = html.match(/<b class="c-2">Adres:<\/b>([\s\S]*?)<\/p>/)?.[1] ?? '';
  const lines = addressBlock.split(/<br\s*\/?>/).map(textOf).filter(Boolean);
  const street = (lines[0] ?? '').replace(/^ul\.\s*/i, '');
  const postal = lines[1]?.match(/^(.*?)\s+(\d{2}-\d{3})$/);
  const phone = addressBlock.match(/tel\.:\s*<b>([^<]+)<\/b>/)?.[1]?.replace(/^\+\s+/, '+').trim() ?? null;

  const rates = new Map<string, NormalizedRate>();
  const add = (currency: string, buyRaw: string, sellRaw: string, at: Date | null) => {
    const buy = normalizeRate(buyRaw);
    const sell = normalizeRate(sellRaw);
    if (rates.has(currency) || (buy === null && sell === null)) return;
    rates.set(currency, { exchangerId: id, currency, buy, sell, rateUpdatedAt: at, source: SOURCE });
  };
  const all = packs(html);
  // Розничный курс главнее оптового: сначала розница, потом опт для недостающих валют.
  for (const { body } of all.filter((p) => /aktualny kurs walut/i.test(p.title))) {
    for (const m of body.matchAll(RETAIL_ROW)) {
      // Варианты в скобках — старые доллары, мелкие купюры, монеты: не основной курс.
      if (!/\(/.test(m[2] ?? '')) add(m[1]!, m[3]!, m[4]!, stampOf(body));
    }
  }
  for (const { body } of all.filter((p) => /hurtowe/i.test(p.title))) {
    for (const m of body.matchAll(WHOLESALE_ROW)) add(m[1]!, m[2]!, m[3]!, stampOf(body));
  }

  const otherBranches = [
    ...new Set(
      [...html.matchAll(new RegExp(`${BASE.replace(/[.]/g, '\\.')}/${citySlug}/([a-z0-9-]+)`, 'g'))]
        .map((m) => m[1]!)
        .filter((slug) => slug !== branch),
    ),
  ];

  return {
    exchanger: {
      id,
      country: 'PL',
      city: cityName,
      name: `EXG ${branchName}`,
      bank: null,
      address: postal ? `${street}, ${postal[2]} ${postal[1]}` : street,
      lat: null,
      lng: null,
      coordsSource: null,
      hours: parseHours(html.match(/<b class="c-2">Godziny otwarcia:<\/b>([\s\S]*?)<\/p>/)?.[1] ?? ''),
      sourceIds: { [SOURCE]: branch },
      phone,
      website: `${BASE}/${citySlug}/${branch}`,
    },
    rates: [...rates.values()],
    otherBranches,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchExg(citySlug: string): Promise<AdapterResult> {
  const seed = SEED_BRANCH[citySlug];
  if (!seed) throw new Error(`exg.pl: нет стартового филиала для «${citySlug}»`);
  const queue = [seed];
  const seen = new Set<string>();
  const result: AdapterResult = { exchangers: [], rates: [] };
  while (queue.length) {
    const branch = queue.shift()!;
    if (seen.has(branch)) continue;
    if (seen.size) await sleep(PAUSE_MS);
    seen.add(branch);
    const response = await fetch(`${BASE}/${citySlug}/${branch}/`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`exg.pl ${branch}: HTTP ${response.status}`);
    const page = parseExgBranch(await response.text(), citySlug, branch);
    result.exchangers.push(page.exchanger);
    result.rates.push(...page.rates);
    queue.push(...page.otherBranches.filter((b) => !seen.has(b)));
  }
  return result;
}
