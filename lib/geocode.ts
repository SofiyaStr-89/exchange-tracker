// Геокодирование польских адресов kantorów (правило склейки 3):
// GUGiK UUG (официальные адресные точки PRG) → Nominatim. Результат хранится в базе навсегда.

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

/** «Targowa 46 (lok. 65), 03-733 Warszawa» → части адреса; null, если нет номера дома. */
export function parsePolishAddress(raw: string): PolishAddress | null {
  let text = raw;
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(/\([^()]*\)/g, ' ');
  }
  text = text.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();

  const m = text.match(/^(.*),\s*(\d{2}-\d{3})\s+(.+)$/);
  if (!m) return null;
  const [, left, postalCode, city] = m;
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
  // С индексом: в Варшаве есть одноимённые улицы в разных районах (Piękna, Ptasia).
  for (const r of await gugikResults(`${a.postalCode} ${a.city}, ${a.street} ${a.number}`)) {
    if (!sameCity(r, a) || r.code !== a.postalCode) continue;
    const p = pointOf(r);
    if (p) return p;
  }
  return null;
}

/**
 * Запасной поиск, когда у источника неточный индекс (kursarz: «Jana Pawła II 29, 00-566» вместо 00-867):
 * без индекса, и берём адрес, только если он один с тем же началом индекса («00-…» — центр Варшавы,
 * а одноимённая ulica Jana Pawła II 29 в Wesołej — «05-…»).
 */
export async function geocodeGugikLoose(a: PolishAddress): Promise<Point | null> {
  if (!a.postalCode) return null;
  const area = a.postalCode.slice(0, 2);
  const matches = (await gugikResults(`${a.city}, ${a.street} ${a.number}`)).filter(
    (r) => sameCity(r, a) && r.code?.slice(0, 2) === area,
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

/** Белорусский адрес через публичный Nominatim (1 запрос в секунду — паузу держит вызывающий код). */
export async function geocodeNominatimBy(address: string, city: string): Promise<Point | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  const clean = address.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  url.searchParams.set('q', clean.includes(city) ? `${clean}, Беларусь` : `${clean}, ${city}, Беларусь`);
  url.searchParams.set('countrycodes', 'by');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ru' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Nominatim: HTTP ${response.status}`);
  const [first] = (await response.json()) as { lat: string; lon: string }[];
  return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
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
