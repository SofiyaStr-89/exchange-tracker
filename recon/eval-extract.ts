// Проверка общего разборщика на сохранённых страницах сайтов (recon/raw/sites) без запросов к ним:
// сколько валют нашлось и совпадают ли курсы с marketportal/kantor.live для тех же точек.
// npx tsx --env-file=.env.local recon/eval-extract.ts

import { readdirSync, readFileSync } from 'node:fs';
import { getDb } from '../lib/db/index.js';
import { exchangers, rates } from '../lib/db/schema.js';
import { eq, isNotNull } from 'drizzle-orm';
import { extractRates, extractTimestamp } from '../lib/extract-rates.js';
import { loadNbpMids } from '../lib/nbp.js';

const mids = await loadNbpMids();
const db = getDb();
const rows = await db
  .select({ website: exchangers.website, currency: rates.currency, buy: rates.buy, sell: rates.sell, source: rates.source })
  .from(exchangers)
  .innerJoin(rates, eq(rates.exchangerId, exchangers.id))
  .where(isNotNull(exchangers.website));
const host = (u: string) => new URL(u).host.replace(/^www\./, '');
const known = new Map<string, Map<string, { buy: number | null; sell: number | null; source: string }>>();
for (const r of rows) {
  const h = host(r.website!);
  if (!known.has(h)) known.set(h, new Map());
  if (!known.get(h)!.has(r.currency) || r.source === 'marketportal') known.get(h)!.set(r.currency, r);
}

let sites = 0, withUsd = 0, compared = 0, matched = 0;
const mismatches: string[] = [];
for (const file of readdirSync('recon/raw/sites')) {
  const h = file.replace(/\.html$/, '');
  const html = readFileSync(`recon/raw/sites/${file}`, 'utf8');
  const found = extractRates(html, mids);
  const ts = extractTimestamp(html);
  const codes = Object.keys(found);
  if (!codes.length) continue;
  sites++;
  if (found.USD) withUsd++;
  const ref = known.get(h);
  let siteCmp = '';
  for (const c of ['USD', 'EUR', 'GBP', 'CHF']) {
    const a = found[c];
    const b = ref?.get(c);
    if (!a || !b) continue;
    compared++;
    const same = (x: number | null, y: number | null) => x === null || y === null || Math.abs(x - y) <= 0.02;
    if (same(a.buy, b.buy) && same(a.sell, b.sell)) matched++;
    else mismatches.push(`${h} ${c}: сайт ${a.buy}/${a.sell}, ${b.source} ${b.buy}/${b.sell}`);
    siteCmp += ` ${c}`;
  }
  console.log(`${h}: валют ${codes.length} (${codes.slice(0, 6).join(',')}) | USD ${found.USD ? `${found.USD.buy}/${found.USD.sell}` : '—'} | время ${ts?.toISOString().slice(0, 16) ?? '—'}${siteCmp ? ` | сверено:${siteCmp}` : ''}`);
}
console.log(`\nсайтов с курсами: ${sites}, с USD: ${withUsd}; сверено курсов: ${compared}, совпало (±0,02): ${matched}`);
for (const m of mismatches) console.log('  расхождение', m);
