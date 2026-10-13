// Словарь «русское слово → белорусское» для поиска по Беларуси (lib/by-words.ts):
// пары name:ru / name улиц, остановок и населённых пунктов OSM вокруг городов из нашего списка.
// Названия улиц меняются редко — пересобирать вручную раз в несколько месяцев: npm run build-by-words.
// Результат — app/public/by-words.json (приложение загружает его, только когда в поиске кириллица).
// Серверы Overpass бывают перегружены: собранное копится в recon/raw/by-words-progress.json (вне git),
// повторный запуск берёт только города, которые ещё не удалось собрать. Начать заново: -- --fresh.
// Если Overpass лежит: скачать выгрузку https://download.geofabrik.de/europe/belarus-latest.osm.pbf (~350 МБ)
// и запустить `npm run build-by-words -- --pbf <файл>` — пары берутся по всей стране сразу.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CITIES } from '../lib/cities.js';
import { createOSMStream } from 'osm-pbf-parser-node';
import { overpass } from '../lib/overpass.js';

const PAUSE_MS = 3000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const WORD = /[\p{L}\d-]+/gu;
const words = (s: string) => (s.toLowerCase().match(WORD) ?? []).map((w) => w.replace(/ё/g, 'е'));

const PROGRESS = 'recon/raw/by-words-progress.json';
const fresh = process.argv.includes('--fresh');
const saved =
  !fresh && existsSync(PROGRESS)
    ? (JSON.parse(readFileSync(PROGRESS, 'utf8')) as { done: string[]; counts: Record<string, Record<string, number>> })
    : { done: [], counts: {} };
const done = new Set(saved.done);
const counts = new Map<string, Map<string, number>>(Object.entries(saved.counts).map(([ru, v]) => [ru, new Map(Object.entries(v))]));

function save(): number {
  const dict: Record<string, string> = {};
  // Частые слова первыми: обратный словарь (lib/by-words.ts → reverse) берёт для белорусского слова первый,
  // то есть самый частый русский вариант («вуліца» → «улица», а не случайное «улиц»).
  const total = (v: Map<string, number>) => [...v.values()].reduce((a, b) => a + b, 0);
  for (const [ru, variants] of [...counts].sort(([a, va], [b, vb]) => total(vb) - total(va) || a.localeCompare(b, 'ru'))) {
    dict[ru] = [...variants].sort((a, b) => b[1] - a[1])[0]![0];
  }
  writeFileSync('app/public/by-words.json', JSON.stringify(dict));
  mkdirSync('recon/raw', { recursive: true });
  const raw = Object.fromEntries([...counts].map(([ru, v]) => [ru, Object.fromEntries(v)]));
  writeFileSync(PROGRESS, JSON.stringify({ done: [...done], counts: raw }));
  return Object.keys(dict).length;
}
// Сначала Минск и областные центры — они дают почти все слова; словарь сохраняется после каждого города.
const FIRST = ['Минск', 'Брест', 'Витебск', 'Гомель', 'Гродно', 'Могилёв'];
const rank = (name: string) => (FIRST.includes(name) ? FIRST.indexOf(name) : FIRST.length);
function addPair(nameRu: string, name: string): void {
  const ru = words(nameRu);
  const be = words(name);
  if (ru.length !== be.length) return; // слова не сопоставить по порядку
  ru.forEach((w, j) => {
    // Только слова из букв: «7-я», «1-й» и т.п. не переводим (их и не нужно).
    if (w === be[j] || !/^[а-я-]+$/.test(w) || !/^[\p{L}-]+$/u.test(be[j]!)) return;
    const m = counts.get(w) ?? new Map<string, number>();
    m.set(be[j]!, (m.get(be[j]!) ?? 0) + 1);
    counts.set(w, m);
  });
}

const pbfIndex = process.argv.indexOf('--pbf');
if (pbfIndex > 0) {
  const file = process.argv[pbfIndex + 1]!;
  let n = 0;
  for await (const item of createOSMStream(file, { withInfo: false })) {
    const tags = (item as { tags?: Record<string, string> }).tags;
    if (!tags?.name || !tags['name:ru'] || !(tags.highway || tags.place || tags.railway)) continue;
    addPair(tags['name:ru'], tags.name);
    if (++n % 20000 === 0) console.log(`${n} названий, слов ${counts.size}`);
  }
  for (const c of CITIES) if (c.country === 'BY') done.add(c.id);
  console.log(`Готово (выгрузка): ${n} названий, ${save()} слов`);
  process.exit(0);
}

const cities = CITIES.filter((c) => c.country === 'BY' && !done.has(c.id)).sort((a, b) => rank(a.name) - rank(b.name));
console.log(`Уже собрано городов: ${done.size}, осталось: ${cities.length}`);
let failed = 0;
for (const [i, city] of cities.entries()) {
  // Минск большой, остальные города — около 7 км вокруг центра.
  const r = city.name === 'Минск' ? 0.13 : 0.065;
  const dLng = r / Math.cos((city.lat * Math.PI) / 180);
  const box = `${(city.lat - r).toFixed(4)},${(city.lng - dLng).toFixed(4)},${(city.lat + r).toFixed(4)},${(city.lng + dLng).toFixed(4)}`;
  const query = `[out:json][timeout:120];
(way(${box})[highway][name]["name:ru"];node(${box})[place][name]["name:ru"];node(${box})[railway][name]["name:ru"];);
out tags;`;
  if (i > 0) await sleep(PAUSE_MS);
  try {
    const elements = await overpass(query, 120_000); // private.coffee отвечает медленно (Минск — 90 с)
    for (const e of elements) addPair(e.tags!['name:ru']!, e.tags!.name!);
    done.add(city.id);
    console.log(`${i + 1}/${cities.length} ${city.name}: ${elements.length} названий, слов ${save()}`);
  } catch (err) {
    failed++;
    console.log(`${i + 1}/${cities.length} ${city.name}: ошибка ${(err as Error).message}`);
  }
}

console.log(`Готово: ${save()} слов, городов с ошибкой: ${failed}`);
