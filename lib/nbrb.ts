// Официальные курсы Нацбанка Беларуси (api.nbrb.by, бесплатно, без ключа): курс за 1 единицу
// для сверки (правило склейки 7) и официальный масштаб валют (правило склейки 5: RUB за 100, PLN за 10…).

import type { MidRates } from './nbp.js';
import { USER_AGENT } from './probe.js';

export interface Nbrb {
  mids: MidRates;
  scales: Record<string, number>;
}

interface NbrbRow {
  Cur_Abbreviation: string;
  Cur_Scale: number;
  Cur_OfficialRate: number;
}

export function parseNbrbRates(rows: NbrbRow[]): Nbrb {
  const mids: MidRates = {};
  const scales: Record<string, number> = {};
  for (const r of rows) {
    if (!(r.Cur_Scale > 0) || !(r.Cur_OfficialRate > 0)) continue;
    mids[r.Cur_Abbreviation] = Math.round((r.Cur_OfficialRate / r.Cur_Scale) * 1e8) / 1e8;
    scales[r.Cur_Abbreviation] = r.Cur_Scale;
  }
  return { mids, scales };
}

const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; data: Nbrb } | null = null;

export async function loadNbrb(): Promise<Nbrb> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  // periodicity=0 — ежедневные курсы (~30 валют), 1 — ежемесячные (редкие валюты).
  const get = async (periodicity: 0 | 1) => {
    const res = await fetch(`https://api.nbrb.by/exrates/rates?periodicity=${periodicity}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`НБРБ: HTTP ${res.status}`);
    return (await res.json()) as NbrbRow[];
  };
  const monthly = await get(1).catch(() => [] as NbrbRow[]);
  const data = parseNbrbRates([...monthly, ...(await get(0))]);
  cached = { at: Date.now(), data };
  return data;
}
