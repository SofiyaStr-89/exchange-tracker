// Словарь «русское слово → белорусское» для поиска по Беларуси (lib/by-words.ts):
// пары name:ru / name улиц, остановок и населённых пунктов OSM вокруг городов из нашего списка.
// Названия улиц меняются редко — пересобирать вручную раз в несколько месяцев: npm run build-by-words.
// Результат — app/public/by-words.json (приложение загружает его, только когда в поиске кириллица).
// Серверы Overpass бывают перегружены: собранное копится в recon/raw/by-words-progress.json (вне git),
// повторный запуск берёт только города, которые ещё не удалось собрать. Начать заново: -- --fresh.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CITIES } from '../lib/cities.js';
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
  for (const [ru, variants] of [...counts].sort(([a], [b]) => a.localeCompare(b, 'ru'))) {
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
    const elements = await overpass(query, city.name === 'Минск' ? 150_000 : 45_000); // сервер занят — не ждём, идём дальше
    for (const e of elements) {
      const ru = words(e.tags!['name:ru']!);
      const be = words(e.tags!.name!);
      if (ru.length !== be.length) continue; // слова не сопоставить по порядку
      ru.forEach((w, j) => {
        if (w === be[j] || !/[а-я]/.test(w)) return;
        const m = counts.get(w) ?? new Map<string, number>();
        m.set(be[j]!, (m.get(be[j]!) ?? 0) + 1);
        counts.set(w, m);
      });
    }
    done.add(city.id);
    console.log(`${i + 1}/${cities.length} ${city.name}: ${elements.length} названий, слов ${save()}`);
  } catch (err) {
    failed++;
    console.log(`${i + 1}/${cities.length} ${city.name}: ошибка ${(err as Error).message}`);
  }
}

console.log(`Готово: ${save()} слов, городов с ошибкой: ${failed}`);
