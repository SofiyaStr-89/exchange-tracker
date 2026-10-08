// Разбор сохранённой страницы источника без запросов к сайту — для отладки адаптера.
// npm run try-parse -- marketportal recon/raw/marketportal-warszawa-eur.html EUR warszawa

import { readFileSync } from 'node:fs';
import { parseMarketportalPage } from '../lib/adapters/marketportal.js';

const [source, file, currency = 'EUR', city = 'warszawa'] = process.argv.slice(2);
if (source !== 'marketportal' || !file) throw new Error('Использование: npm run try-parse -- marketportal <файл> [валюта] [город]');
const r = parseMarketportalPage(readFileSync(file, 'utf8'), currency, city);
const stamps = r.rates.map((x) => x.rateUpdatedAt?.toISOString().slice(11, 16)).sort();
console.log(`обменников: ${r.exchangers.length}, с координатами: ${r.exchangers.filter((e) => e.lat !== null).length}, с часами: ${r.exchangers.filter((e) => e.hours).length}, с телефоном: ${r.exchangers.filter((e) => e.phone).length}, с сайтом: ${r.exchangers.filter((e) => e.website).length}`);
console.log(`курсов ${currency}: ${r.rates.length}, время (UTC) от ${stamps[0]} до ${stamps.at(-1)}`);
console.log('пример:', r.exchangers[0], r.rates[0]);
