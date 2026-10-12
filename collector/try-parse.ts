// Разбор сохранённой страницы источника без запросов к сайту — для отладки адаптера.
// npm run try-parse -- marketportal recon/raw/marketportal-warszawa-eur.html EUR warszawa
// npm run try-parse -- exg recon/raw/exg-atrium-targowek.html atrium-targowek warszawa
// npm run try-parse -- sprawa recon/raw/sprawa-warszawa.html - warszawa

import { readFileSync } from 'node:fs';
import { parseExgBranch } from '../lib/adapters/exg.js';
import { parseMarketportalPage } from '../lib/adapters/marketportal.js';
import { parseSprawa } from '../lib/adapters/sprawa.js';

const [source, file, arg = '', city = 'warszawa'] = process.argv.slice(2);
if (!source || !file) throw new Error('Использование: npm run try-parse -- <marketportal|exg|sprawa> <файл> [валюта|филиал] [город]');
const html = readFileSync(file, 'utf8');

if (source === 'marketportal') {
  const r = parseMarketportalPage(html, arg || 'EUR', city);
  const stamps = r.rates.map((x) => x.rateUpdatedAt?.toISOString().slice(11, 16)).sort();
  console.log(`обменников: ${r.exchangers.length}, с координатами: ${r.exchangers.filter((e) => e.lat !== null).length}, с часами: ${r.exchangers.filter((e) => e.hours).length}`);
  console.log(`курсов: ${r.rates.length}, время (UTC) от ${stamps[0]} до ${stamps.at(-1)}`);
} else if (source === 'exg') {
  const r = parseExgBranch(html, city, arg || 'branch');
  console.log(r.exchanger);
  console.log(`курсов: ${r.rates.length}`, r.rates.slice(0, 5).map((x) => `${x.currency} ${x.buy}/${x.sell} ${x.rateUpdatedAt?.toISOString()}`));
  console.log('другие филиалы:', r.otherBranches);
} else if (source === 'sprawa') {
  const r = parseSprawa(html, city);
  console.log(r.exchangers);
  console.log(`курсов: ${r.rates.length}`, r.rates.slice(0, 4).map((x) => `${x.currency} ${x.buy}/${x.sell} ${x.rateUpdatedAt?.toISOString()}`));
} else {
  throw new Error(`Неизвестный источник ${source}`);
}
