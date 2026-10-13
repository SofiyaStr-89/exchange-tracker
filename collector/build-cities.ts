// Список городов (шаг 8): польские — из marketportal (встроенный JSON городов), белорусские — из myfin
// (ссылки /currency/<город>); центры городов — из OpenStreetMap (один запрос Overpass на страну).
// Результат — lib/cities-data.ts (в git). Запуск редкий, вручную: npm run build-cities.
// Страницы источников берутся из recon/raw (сохранены при разведке), чтобы не дёргать сайты лишний раз.

import { readFileSync, writeFileSync } from 'node:fs';
import { decodeEntities } from '../lib/html.js';
import { USER_AGENT } from '../lib/probe.js';

interface Place {
  name: string;
  lat: number;
  lng: number;
  rank: number;
  population: number;
}

const plain = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

// ——— названия городов из источников ———
const mp = readFileSync('recon/raw/marketportal-warszawa-eur.html', 'utf8');
const plCities = new Map<string, string>(); // slug → название
for (const m of decodeEntities(mp).matchAll(/"CityName":"([^"]+)","SeoName":"([a-z0-9-]+)"/g)) {
  plCities.set(m[2]!, JSON.parse(`"${m[1]}"`));
}
const mf = readFileSync('recon/raw/myfin-currency-minsk.html', 'utf8');
const byCities = new Map<string, string>();
for (const m of mf.matchAll(/href="\/currency\/([a-z0-9-]+)"[^>]*>\s*([^<]{2,40}?)\s*</g)) {
  const [slug, name] = [m[1]!, m[2]!.trim()];
  if (/^[a-z]{3}$/.test(slug) || slug === 'cb-rf' || /курс|цб/i.test(name)) continue;
  byCities.set(slug, name);
}
console.log(`городов: Польша ${plCities.size}, Беларусь ${byCities.size}`);

// ——— центры из OSM ———
const RANK: Record<string, number> = { city: 3, town: 2, village: 1, hamlet: 0 };

async function overpass(query: string): Promise<{ tags: Record<string, string>; lat: number; lon: number }[]> {
  for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.ok) return ((await res.json()) as { elements: { tags: Record<string, string>; lat: number; lon: number }[] }).elements;
      console.log(`${endpoint}: HTTP ${res.status}`);
    } catch (err) {
      console.log(`${endpoint}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error('Overpass недоступен');
}

async function places(iso: string, nameKey: string): Promise<Map<string, Place>> {
  const els = await overpass(`[out:json][timeout:170];area["ISO3166-1"="${iso}"][admin_level=2]->.c;node(area.c)["place"~"^(city|town)$"];out body;`);
  const best = new Map<string, Place>();
  for (const e of els) {
    const name = e.tags[nameKey] ?? e.tags.name;
    if (!name || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
    const p = { name, lat: e.lat, lng: e.lon, rank: RANK[e.tags.place!] ?? 0, population: Number(e.tags.population) || 0 };
    const cur = best.get(name);
    // Одноимённых мест несколько — берём самое крупное.
    if (!cur || p.rank > cur.rank || (p.rank === cur.rank && p.population > cur.population)) best.set(name, p);
  }
  return best;
}

/** Места, которых нет в ответе Overpass, — через Nominatim, 1 запрос в секунду, с повтором при сбое. */
async function nominatimPlace(name: string, country: string): Promise<Place | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await new Promise((r) => setTimeout(r, attempt ? 5000 : 1100));
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', name);
      url.searchParams.set('countrycodes', country);
      url.searchParams.set('featureType', 'settlement');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '1');
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': country === 'by' ? 'ru' : 'pl' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const [first] = (await res.json()) as { lat: string; lon: string }[];
      return first ? { name, lat: Number(first.lat), lng: Number(first.lon), rank: 1, population: 0 } : null;
    } catch {
      // повторим один раз
    }
  }
  return null;
}

// Overpass бывает перегружен — тогда все центры найдёт Nominatim (медленнее, но надёжно).
const safePlaces = (iso: string, key: string) => places(iso, key).catch(() => new Map<string, Place>());
const plPlaces = await safePlaces('PL', 'name');
await new Promise((r) => setTimeout(r, 5000));
const byPlaces = await safePlaces('BY', 'name:ru');
for (const [map, names, cc] of [
  [plPlaces, [...plCities.values()], 'pl'],
  [byPlaces, [...byCities.values()], 'by'],
] as const) {
  for (const name of names) {
    if (map.has(name)) continue;
    const p = await nominatimPlace(name, cc);
    if (p) map.set(name, p);
  }
}

// Источники, у которых есть город: kantor.live и marketportal — по коду marketportal, kursarz — по id города; exg и Sprawa — известные города.
const EXG = new Set(['warszawa']);
const SPRAWA = new Set(['warszawa', 'wroclaw', 'lodz']);

const out: string[] = [];
const missing: string[] = [];
for (const [slug, name] of plCities) {
  const p = plPlaces.get(name);
  if (!p) {
    missing.push(`PL ${name}`);
    continue;
  }
  const sources: Record<string, string> = { kantorlive: slug, kursarz: `pl-${slug}`, marketportal: slug };
  if (EXG.has(slug)) sources.exg = slug;
  if (SPRAWA.has(slug)) sources.sprawa = slug;
  sources.site = `pl-${slug}`;
  sources.osm = name;
  const stem = plain(name).slice(0, Math.max(4, plain(name).length - 2));
  out.push(
    `  { id: 'pl-${slug}', country: 'PL', name: ${JSON.stringify(name)}, lat: ${p.lat.toFixed(5)}, lng: ${p.lng.toFixed(5)}, sources: ${JSON.stringify(sources)}, aliases: ${JSON.stringify([...new Set([name.toLowerCase().slice(0, Math.max(4, name.length - 2)), stem])])} },`,
  );
}
for (const [slug, name] of byCities) {
  const p = byPlaces.get(name);
  if (!p) {
    missing.push(`BY ${name}`);
    continue;
  }
  const stem = name.toLowerCase().replace(/ё/g, 'е').slice(0, Math.max(4, name.length - 1));
  out.push(
    `  { id: 'by-${slug}', country: 'BY', name: ${JSON.stringify(name)}, lat: ${p.lat.toFixed(5)}, lng: ${p.lng.toFixed(5)}, sources: ${JSON.stringify({ belarusbank: `by-${slug}`, myfin: slug })}, aliases: ${JSON.stringify([stem, slug])} },`,
  );
}

writeFileSync(
  'lib/cities-data.ts',
  `// Сгенерировано collector/build-cities.ts (${new Date().toISOString().slice(0, 10)}): города из marketportal и myfin,
// центры — OpenStreetMap. Не править вручную — перегенерировать.

import type { City } from './cities.js';

export const CITIES_DATA: City[] = [
${out.join('\n')}
];
`,
);
console.log(`записано городов: ${out.length}; без центра в OSM: ${missing.length}`);
if (missing.length) console.log('  ' + missing.join(', '));
