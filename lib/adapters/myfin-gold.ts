// Мерные слитки золота в банках Беларуси, myfin.by/bank/metally/gold: по банку — цена слитка 1…1000 г,
// «банк покупает» (пок.) и «банк продаёт» (пр.). Только раздел «Слитки»: «Металлические счета» — вклад без слитка,
// Национальный банк — не отделение. Цены банка, а не отделения: в каких отделениях продают слитки, источник не говорит.

import { bankKey } from '../gold.js';
import { decodeEntities } from '../html.js';
import { USER_AGENT } from '../probe.js';
import type { AdapterResult, NormalizedGold } from './types.js';

export const SOURCE = 'myfin-gold';
export const MAX_AGE_MS = 3 * 60 * 60 * 1000;


const num = (s: string) => {
  const v = Number.parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
};

export function parseMyfinGold(html: string, now = new Date()): NormalizedGold[] {
  const body = html.slice(html.indexOf("bank-exchange-table__body'"));
  const sections = body.split(/<span class="bank-exchange-table__divider-title">([^<]*)<\/span>/);
  const items: NormalizedGold[] = [];
  for (let k = 1; k < sections.length; k += 2) {
    if (!/слитк/i.test(sections[k]!)) continue;
    for (const m of sections[k + 1]!.matchAll(/body-item-name">([^<]*)<\/span>([\s\S]*?)(?=body-item-name|$)/g)) {
      const bank = decodeEntities(m[1]!).trim();
      if (/национальный банк/i.test(bank)) continue;
      const values = [...m[2]!.matchAll(/data-gram-val-id="g(\d+)">\s*([^<]*?)\s*<\/div>/g)];
      // Пары подряд: сначала «пок.» (банк покупает), затем «пр.» (банк продаёт).
      for (let i = 0; i + 1 < values.length; i += 2) {
        const grams = values[i]![1]!;
        if (values[i + 1]![1] !== grams) continue;
        const buy = num(values[i]![2]!);
        const sell = num(values[i + 1]![2]!);
        if (buy === null && sell === null) continue;
        items.push({ country: 'BY', owner: bankKey(bank), kind: 'bar', item: grams, buy, sell, priceUpdatedAt: now, source: SOURCE });
      }
    }
  }
  return items;
}

export async function fetchMyfinGold(): Promise<AdapterResult> {
  const res = await fetch('https://myfin.by/bank/metally/gold', { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`myfin золото: HTTP ${res.status}`);
  const items = parseMyfinGold(await res.text());
  if (!items.length) throw new Error('myfin золото: нет слитков на странице — сменилась вёрстка?');
  return { exchangers: [], rates: [], gold: { ownerPrefix: 'bank:', items } };
}
