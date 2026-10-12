// Средние курсы Нацбанка Польши (api.nbp.pl, бесплатно, без ключа): таблица A (основные валюты,
// каждый рабочий день) и B (редкие, раз в неделю). Нужны для проверки правдоподобия курсов (правило склейки 7).

import { USER_AGENT } from './probe.js';

export type MidRates = Record<string, number>;

interface NbpTable {
  table: string;
  rates: { code: string; mid: number }[];
}

/** Таблица A главнее B: в B встречаются те же коды с другим смыслом. */
export function parseNbpTables(a: NbpTable[], b: NbpTable[]): MidRates {
  const mids: MidRates = {};
  // Сначала B, потом A: таблица A перекрывает B.
  for (const table of [...b, ...a]) for (const r of table.rates) if (r.mid > 0) mids[r.code] = r.mid;
  return mids;
}

const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; mids: MidRates } | null = null;

export async function loadNbpMids(): Promise<MidRates> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.mids;
  const get = async (table: 'A' | 'B') => {
    const res = await fetch(`https://api.nbp.pl/api/exchangerates/tables/${table}/?format=json`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`NBP ${table}: HTTP ${res.status}`);
    return (await res.json()) as NbpTable[];
  };
  const mids = parseNbpTables(await get('A'), await get('B'));
  cached = { at: Date.now(), mids };
  return mids;
}
