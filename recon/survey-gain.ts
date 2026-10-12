// Сколько новых точек с курсом дадут сайты kantorów: у каких сайтов из обхода точки на карте сейчас без курса.
// npx tsx --env-file=.env.local recon/survey-gain.ts

import { readFileSync } from 'node:fs';
import { CITIES } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { loadInBounds } from '../lib/exchangers.js';

const report = readFileSync('research_notes/Источники курсов Варшавы/sites_survey.md', 'utf8');
const withRates = new Set(
  report
    .split('\n')
    .filter((l) => l.includes('курсы в HTML'))
    .map((l) => l.split('|')[1]!.trim()),
);
const platforms = report
  .split('\n')
  .filter((l) => l.startsWith('| ') && !l.startsWith('| Сайт'))
  .map((l) => [l.split('|')[1]!.trim(), l.split('|')[5]!.trim(), l.split('|')[6]!.trim()]);

const city = CITIES[0]!;
const d = 0.089;
const { inView } = await loadInBounds(
  getDb(),
  { south: city.lat - d, north: city.lat + d, west: city.lng - d / Math.cos((city.lat * Math.PI) / 180), east: city.lng + d / Math.cos((city.lat * Math.PI) / 180) },
  'USD',
);
const host = (u: string) => new URL(u).host.replace(/^www\./, '');
const gain = new Map<string, string[]>();
for (const e of inView) {
  if (!e.website || Object.keys(e.rates).length) continue;
  const h = host(e.website);
  if (withRates.has(h)) gain.set(h, [...(gain.get(h) ?? []), e.name]);
}
console.log(`точек без курса, у которых сайт публикует курс: ${[...gain.values()].flat().length} (сайтов: ${gain.size})`);
for (const [h, names] of gain) console.log(`  ${h}: ${names.join(', ')}`);
console.log('\nплатформы/время по сайтам с курсами:');
for (const [h, stamp, plat] of platforms.filter((p) => withRates.has(p[0]!))) console.log(`  ${h} | время: ${stamp || '—'} | ${plat || '—'}`);
