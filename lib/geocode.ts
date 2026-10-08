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

export async function geocodeGugik(a: PolishAddress): Promise<Point | null> {
  const url = new URL('https://services.gugik.gov.pl/uug/');
  url.searchParams.set('request', 'GetAddress');
  // С индексом: в Варшаве есть одноимённые улицы в разных районах (Piękna, Ptasia).
  url.searchParams.set('address', `${a.postalCode} ${a.city}, ${a.street} ${a.number}`);
  url.searchParams.set('srid', '4326');
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GUGiK: HTTP ${response.status}`);
  const json = (await response.json()) as { results?: Record<string, GugikResult> | null };
  for (const r of Object.values(json.results ?? {})) {
    if (r.city?.toLowerCase() !== a.city.toLowerCase() || r.code !== a.postalCode) continue;
    const lat = Number(r.y);
    const lng = Number(r.x);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
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
