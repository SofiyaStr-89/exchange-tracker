// Сколько отделений myfin без координат находят пару у onliner по ключу адреса (без запросов к сайтам).
// npx tsx --env-file=.env.local recon/eval-onliner.ts

import { readFileSync } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { byAddressKey, parseOnlinerPoints } from '../lib/onliner.js';

const points = parseOnlinerPoints(readFileSync('recon/raw/onliner-kurs.html', 'utf8'));
const byKey = new Map<string, typeof points>();
for (const p of points) {
  const k = byAddressKey(p.address);
  if (k) byKey.set(k, [...(byKey.get(k) ?? []), p]);
}
const rows = await getDb()
  .select({ id: exchangers.id, bank: exchangers.bank, address: exchangers.address })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'BY'), isNull(exchangers.lat)));
let matched = 0;
let sameBank = 0;
const misses: string[] = [];
for (const r of rows) {
  const cands = byKey.get(byAddressKey(r.address)) ?? [];
  if (cands.length) {
    matched++;
    if (cands.some((c) => c.bank.toLowerCase().replace(/[^а-яa-z]/g, '').slice(0, 5) === (r.bank ?? '').toLowerCase().replace(/[^а-яa-z]/g, '').slice(0, 5))) sameBank++;
  } else misses.push(`${r.bank} | ${r.address} → «${byAddressKey(r.address)}»`);
}
console.log(`точек onliner: ${points.length}, с ключом: ${byKey.size}; без координат BY: ${rows.length}; нашли пару: ${matched} (из них того же банка: ${sameBank})`);
console.log('примеры без пары:\n  ' + misses.slice(0, 15).join('\n  '));
