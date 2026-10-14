// Геокодирование польских адресов kantorów (правило склейки 3):
// GUGiK UUG (официальные адресные точки PRG) → Nominatim. Результат хранится в базе навсегда.

import { byAddressKey } from './onliner.js';
import { USER_AGENT } from './probe.js';

export interface PolishAddress {
  street: string;
  number: string;
  postalCode: string;
  city: string;
}

export interface Point {
  lat: number;
  lng: number;
}

/** «Targowa 46 (lok. 65), 03-733 Warszawa» → части адреса; индекс может отсутствовать (''); null, если нет номера дома. */
export function parsePolishAddress(raw: string): PolishAddress | null {
  let text = raw;
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(/\([^()]*\)/g, ' ');
  }
  text = text.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();

  const m = text.match(/^(.*),\s*(?:(\d{2}-\d{3})\s+)?([^,\d][^,]*)$/);
  if (!m) return null;
  const [, left, postalCode = '', city] = m;
  const streetPart = left!
    .replace(/^Al\.\s*/, 'Aleje ')
    .replace(/^al\.\s*/, 'aleje ')
    .replace(/^ul\.\s*/i, '')
    .trim();

  const n = streetPart.match(/^(.+?)\s+(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?)(?:\s|$)/);
  if (!n) return null;
  return { street: n[1]!, number: n[2]!, postalCode: postalCode!, city: city!.trim() };
}

const TIMEOUT_MS = 15_000;

interface GugikResult {
  city?: string;
  code?: string;
  x?: string;
  y?: string;
}

async function gugikResults(address: string): Promise<GugikResult[]> {
  const url = new URL('https://services.gugik.gov.pl/uug/');
  url.searchParams.set('request', 'GetAddress');
  url.searchParams.set('address', address);
  url.searchParams.set('srid', '4326');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GUGiK: HTTP ${response.status}`);
  // На непонятный адрес GUGiK отвечает текстом «Blad zapytania.» с кодом 200 — это «не найдено», а не сбой.
  try {
    const json = JSON.parse(await response.text()) as { results?: Record<string, GugikResult> | null };
    return Object.values(json.results ?? {});
  } catch {
    return [];
  }
}

function pointOf(r: GugikResult): Point | null {
  const lat = Number(r.y);
  const lng = Number(r.x);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const sameCity = (r: GugikResult, a: PolishAddress) => r.city?.toLowerCase() === a.city.toLowerCase();

export async function geocodeGugik(a: PolishAddress): Promise<Point | null> {
  if (!a.postalCode) return null;
  // С индексом: в Варшаве есть одноимённые улицы в разных районах (Piękna, Ptasia).
  for (const r of await gugikResults(`${a.postalCode} ${a.city}, ${a.street} ${a.number}`)) {
    if (!sameCity(r, a) || r.code !== a.postalCode) continue;
    const p = pointOf(r);
    if (p) return p;
  }
  return null;
}

/**
 * Запасной поиск, когда у источника неточный индекс или его нет (kursarz: «Jana Pawła II 29, 00-566» вместо 00-867):
 * без индекса, и берём адрес, только если он один с тем же началом индекса («00-…» — центр Варшавы,
 * а одноимённая ulica Jana Pawła II 29 в Wesołej — «05-…»). Без индекса — только если адрес в городе один.
 */
export async function geocodeGugikLoose(a: PolishAddress): Promise<Point | null> {
  const area = a.postalCode.slice(0, 2);
  const matches = (await gugikResults(`${a.city}, ${a.street} ${a.number}`)).filter(
    (r) => sameCity(r, a) && (!area || r.code?.slice(0, 2) === area),
  );
  return matches.length === 1 ? pointOf(matches[0]!) : null;
}

/** Публичный Nominatim: не больше 1 запроса в секунду (паузу держит вызывающий код). */
export async function geocodeNominatim(a: PolishAddress): Promise<Point | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('street', `${a.number} ${a.street}`);
  url.searchParams.set('city', a.city);
  url.searchParams.set('postalcode', a.postalCode);
  url.searchParams.set('countrycodes', 'pl');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pl' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`);
  const [first] = (await response.json()) as { lat: string; lon: string }[];
  if (!first) return null;
  return { lat: Number(first.lat), lng: Number(first.lon) };
}

interface NominatimHit {
  lat: string;
  lon: string;
  addresstype?: string;
  address?: Record<string, string | undefined>;
}

const plainRu = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/**
 * Совпадает ли ответ Nominatim с адресом: ключ «московская 208» — номер дома начинается с 208, улица содержит «москов».
 * Без проверки Nominatim на «Московская, 208-1» возвращал точку в 4 км (Брест, ВТБ).
 */
export function hitMatchesKey(hit: NominatimHit, key: string): boolean {
  const m = key.match(/^(.*\S)\s+(\d+)/);
  if (!m) return true;
  // Любое слово улицы (≥4 букв) по основе из 4 букв: «газеты Звезда» ↔ «проспект Газеты Звязда».
  const words = m[1]!.split(/\s+/).map((w) => plainRu(w.replace(/\.$/, ''))).filter((w) => w.length >= 4);
  const house = plainRu(hit.address?.house_number ?? '');
  const road = plainRu([hit.address?.road, hit.address?.pedestrian, hit.address?.square].filter(Boolean).join(' '));
  return house.match(/^\d+/)?.[0] === m[2] && (!words.length || words.some((w) => road.includes(w.slice(0, 4))));
}

async function nominatimBy(q: string, key: string): Promise<Point | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('countrycodes', 'by');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', key ? '5' : '1');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`);
  const hits = (await response.json()) as NominatimHit[];
  const hit = hits.find((h) => !TOO_WIDE.has(h.addresstype ?? '') && (!key || hitMatchesKey(h, key)));
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

/** Белорусский адрес через публичный Nominatim (1 запрос в секунду — паузу держит вызывающий код). */
export async function geocodeNominatimBy(address: string, city: string): Promise<Point | null> {
  const clean = address.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return nominatimBy(clean.includes(city) ? `${clean}, Беларусь` : `${clean}, ${city}, Беларусь`, byAddressKey(address));
}

/** Названия мест из кавычек («Экспобел», "ГИППО") — для поиска ТЦ, когда у адреса нет улицы с номером. */
export function placeNamesFromAddress(address: string): string[] {
  const names = [...address.matchAll(/(\S+\s+)?[«"“]([^»"”]{2,40})[»"”]/g)]
    // «пр. газеты "Звезда"» — это улица, а не место.
    .filter((m) => !/^газет/i.test(m[1]?.trim() ?? ''))
    .map((m) => m[2]!.trim());
  return [...new Set(names)];
}

/** Место по названию (ТЦ, магазин) рядом с городом через Nominatim (1 запрос в секунду — паузу держит вызывающий код). */
export async function geocodePlaceBy(name: string, city: string): Promise<Point | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', `${name}, ${city}, Беларусь`);
  url.searchParams.set('countrycodes', 'by');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`);
  const [first] = (await response.json()) as { lat: string; lon: string }[];
  return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
}

interface PhotonFeature {
  properties: Record<string, string | undefined>;
  geometry: { coordinates: [number, number] };
}

const plainPl = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

async function photonSearch(q: string, near?: Point): Promise<PhotonFeature[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '5');
  if (near) {
    url.searchParams.set('lat', String(near.lat));
    url.searchParams.set('lon', String(near.lng));
  }
  const response = await fetch(url.toString(), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Photon: HTTP ${response.status}`);
  return ((await response.json()) as { features?: PhotonFeature[] }).features ?? [];
}

/** Основа названия улицы без слов-типов: «Aleje Komisji…» → «komisji…», «Władysława Broniewskiego» → «broniewskiego». */
const streetCore = (street: string) =>
  plainPl(street)
    .replace(/\b(ul|al|aleje|aleja|ulica|plac|pl|rondo|os|osiedle)\.?\s+/g, '')
    .trim();

/**
 * Запасной геокодер — Photon (поиск по OSM, терпит неточности): только точка с тем же городом, тем же номером дома
 * и улицей, которая содержит начало нашей. При опечатке («Broniewskego») — второй запрос по началу названия улицы.
 */
export async function geocodePhoton(a: PolishAddress, near?: Point): Promise<Point | null> {
  const core = streetCore(a.street);
  const stem = core.split(' ').pop()!.slice(0, Math.max(5, core.split(' ').pop()!.length - 3));
  const number = plainPl(a.number);
  for (const q of [`${a.street} ${a.number}, ${a.city}`, `${stem} ${a.number}, ${a.city}`]) {
    for (const f of await photonSearch(q, near)) {
      const p = f.properties;
      if (plainPl(p.city ?? '') !== plainPl(a.city) || p.countrycode !== 'PL') continue;
      // Индекс известен — одноимённая улица в другом районе («05-…» вместо «00-…») не годится.
      if (a.postalCode && p.postcode && p.postcode.slice(0, 2) !== a.postalCode.slice(0, 2)) continue;
      const house = plainPl(p.housenumber ?? '');
      if (house !== number && !house.startsWith(`${number.split('/')[0]}/`) && house !== number.split('/')[0]) continue;
      if (!plainPl(p.street ?? '').includes(stem)) continue;
      const [lng, lat] = f.geometry.coordinates;
      return { lat, lng };
    }
  }
  return null;
}

/** «Al. Jerozolimskie / E. Plater …» — перекрёсток: точка Photon, в названии или адресе которой есть обе улицы. */
export function intersectionStreets(address: string): [string, string] | null {
  const head = address.split(',')[0]!.replace(/\([^)]*\)/g, ' ');
  const m = head.match(/^(.*?\p{L}\.?)\s*\/\s*(\p{L}.*)$/u);
  if (!m) return null;
  const clean = (s: string) => streetCore(s.replace(/\b(lok|lokal|pawilon|paw)\.?\s*\S+/gi, '').replace(/\d+\w*/g, '')).replace(/^\p{L}\.\s*/u, '').trim();
  const [x, y] = [clean(m[1]!), clean(m[2]!)];
  return x.length >= 4 && y.length >= 4 ? [x, y] : null;
}

export async function geocodeIntersection(address: string, city: string, near?: Point): Promise<Point | null> {
  const streets = intersectionStreets(address);
  if (!streets) return null;
  const stems = streets.map((s) => s.split(' ').pop()!.slice(0, 6));
  for (const f of await photonSearch(`${streets[1]}, ${streets[0]}, ${city}`, near)) {
    const p = f.properties;
    if (plainPl(p.city ?? '') !== plainPl(city)) continue;
    const text = plainPl(`${p.name ?? ''} ${p.street ?? ''}`);
    if (stems.every((s) => text.includes(s))) {
      const [lng, lat] = f.geometry.coordinates;
      return { lat, lng };
    }
  }
  return null;
}

// ——— Беларусь: нестандартные адреса myfin ———

const LATIN_TO_CYRILLIC: Record<string, string> = { a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у', A: 'А', C: 'С', E: 'Е', O: 'О', P: 'Р', X: 'Х', B: 'В', H: 'Н', K: 'К', M: 'М', T: 'Т' };
/** Организационные слова в скобках: «(ЗАО ВЦ Аквабел)» → «Аквабел», «(магазин Евроопт)» → «Евроопт». */
// \b в JS понимает только латиницу — границы слова для кириллицы через (?<!\p{L}) / (?!\p{L}).
const ORG_WORDS = /(?<!\p{L})(ЗАО|ООО|ОАО|ЧУП|ИП|ВЦ|БЦ|ТЦ|ТРЦ|ТРК|ТК|магазин|универсам|ун-сам|гипермаркет|супермаркет)(?!\p{L})\.?/giu;

/** Латинские буквы внутри русских слов («Русcиянова»), сокращения и кавычки. */
export function cleanByAddress(address: string): string {
  return address
    .replace(/[\p{L}]+/gu, (w) => (/[а-яё]/i.test(w) ? w.replace(/[aceopxyACEOPXBHKMT]/g, (ch) => LATIN_TO_CYRILLIC[ch] ?? ch) : w))
    .replace(/газеты\s*["«“]?\s*Звезда\s*["»”]?/giu, 'Газеты Звязда') // в OSM по-белорусски и в русском названии
    .replace(/(^|\s)Сов\.\s*/gu, '$1Советских ')
    .replace(/(^|\s)пр\.\s*/gu, '$1проспект ')
    .replace(/(^|\s)ул\.\s*/gu, '$1улица ')
    .replace(/(^|\s)ун-сам(?!\p{L})/gu, '$1универсам')
    .replace(/(\S+ский)\s+с\/с/gu, '$1 сельский Совет')
    .replace(/[«»"“”]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

/** Запросы к Nominatim для адреса, который не нашёлся как есть — от точного к приблизительному. */
export function byQueries(address: string, city: string): string[] {
  const clean = cleanByAddress(address);
  const noParens = clean.replace(/\([^)]*\)/g, ' ').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
  const queries: string[] = [];
  const add = (q: string) => queries.includes(q) || queries.push(q);
  const district = city === 'Минск' ? 'Минский район' : city;
  const withCity = (q: string) => (q.includes(city) ? q : `${q}, ${city}`);

  add(withCity(noParens));
  // «19, универсам Чкаловский, Минск улица Воронянского» → «улица Воронянского 19»
  const lead = noParens.match(/^(\d+\p{L}?),.*(?<!\p{L})(улица|проспект|переулок)\s+([\p{L}-]+)/u);
  if (lead) add(withCity(`${lead[2]} ${lead[3]} ${lead[1]}`));
  // «Поселок Лесной, 19а, Минск» — посёлок рядом с городом.
  const village = noParens.match(/(?:поселок|посёлок|аг\.|агрогородок|д\.|деревня)\s+([\p{L}-]+),?\s*(\d+\p{L}?)/iu);
  if (village) add(`${village[1]} ${village[2]}, ${district}`);
  // «Минский район, Боровлянский сельский Совет, 43 (магазин Евроопт)» — место из скобок с номером и сельсоветом.
  const number = noParens.match(/(?:^|,\s*)(\d+\p{L}?)(?:\s*,|\s*$)/u)?.[1];
  const council = clean.match(/[\p{L}-]+ский сельский Совет/u)?.[0];
  for (const inside of clean.match(/\(([^)]*)\)/g) ?? []) {
    const place = inside.slice(1, -1).replace(ORG_WORDS, ' ').replace(/\s+/g, ' ').trim();
    if (place.length < 3) continue;
    if (number && council) add(`${place} ${number}, ${council}`);
    else if (!number) add(withCity(place)); // адрес без номера («пересечение … МКАД») — по названию места
  }
  // «трасса Р-1, 9-й км» / «9 км Московского шоссе» — километр трассы.
  const km = clean.match(/(\d+)(?:-й)?\s*км/u)?.[1];
  const highway = clean.match(/([\p{L}]+(?:ое|ого))\s+шоссе/u)?.[1];
  if (km && highway) add(`${highway.replace(/ого$/, 'ое')} шоссе ${km} км, ${district}`);
  return queries;
}

/** Ответ «весь район / вся область» — не место обменника. */
const TOO_WIDE = new Set(['country', 'state', 'region', 'county', 'municipality', 'city', 'town']);

export async function geocodeNominatimQuery(q: string, key = ''): Promise<Point | null> {
  return nominatimBy(`${q}, Беларусь`, key);
}
