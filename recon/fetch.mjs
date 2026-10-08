// Шаг 1: разведка источников. Скачивает по одной странице/ответу с каждого источника
// и сохраняет в recon/raw/. Запуск: node recon/fetch.mjs [имя ...]
// Без аргументов качает всё; с аргументами — только указанные (например: node recon/fetch.mjs sber-api).

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW_DIR = join(dirname(fileURLToPath(import.meta.url)), 'raw');
const PAUSE_MS = 2000;
const USER_AGENT =
  'ExchangeMapRecon/0.1 (personal non-commercial project; one-off source check)';

const SOURCES = [
  { name: 'kantorlive-warszawa', url: 'https://kantor.live/kantory/warszawa', ext: 'html' },
  // Внутренний JSON, которым пользуется режим «Na mapie» (найден в js/map.*.js сайта).
  {
    name: 'kantorlive-map-api-warszawa',
    url: 'https://kantor.live/api/v1/kantors?city=warszawa&per_page=1000&locale=pl',
    ext: 'json',
  },
  { name: 'ratesfm-warsaw', url: 'https://rates.fm/pl-pl/currency/exchanger/warsaw/', ext: 'html' },
  { name: 'myfin-minsk', url: 'https://myfin.by/bank/belarusbank/currency', ext: 'html' },
  // Страница одного отделения: проверяем, есть ли там координаты и часы работы.
  {
    name: 'myfin-department-minsk',
    url: 'https://myfin.by/bank/belarusbank/department/232-minsk-pr-dzerzhinskogo-69-1',
    ext: 'html',
  },
  {
    name: 'belarusbank-api-minsk',
    url: 'https://belarusbank.by/api/kursExchange?city=' + encodeURIComponent('Минск'),
    ext: 'json',
  },
  {
    name: 'sber-api-doc',
    url: 'https://www.sber-bank.by/files/up/42533/' + encodeURIComponent('Описание_сервиса_Курсы_валют.pdf'),
    ext: 'pdf',
  },
  // Адрес и параметры взяты из PDF-описания выше. Cash = наличный обмен в отделениях.
  {
    name: 'sber-api-cash',
    url: 'https://developer.sber-bank.by/api/rates/v1/currencyExchange?exchangeType=Cash',
    ext: 'json',
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOne({ name, url, ext }) {
  const started = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
  const body = Buffer.from(await res.arrayBuffer());
  await writeFile(join(RAW_DIR, `${name}.${ext}`), body);
  const meta = {
    name,
    url,
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: body.length,
    ms: Date.now() - started,
    fetchedAt: new Date().toISOString(),
  };
  await writeFile(join(RAW_DIR, `${name}.meta.json`), JSON.stringify(meta, null, 2));
  return meta;
}

const only = process.argv.slice(2);
const targets = only.length ? SOURCES.filter((s) => only.includes(s.name)) : SOURCES;

await mkdir(RAW_DIR, { recursive: true });
for (const [i, src] of targets.entries()) {
  if (i > 0) await sleep(PAUSE_MS);
  try {
    const m = await fetchOne(src);
    console.log(`${m.status} ${m.name} ${m.bytes} B ${m.ms} ms (${m.contentType})`);
  } catch (err) {
    console.log(`ERR ${src.name}: ${err.message}`);
  }
}
