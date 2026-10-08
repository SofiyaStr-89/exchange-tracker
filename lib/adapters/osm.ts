// Мастер-список обменников из OpenStreetMap (Overpass API): координаты, адрес, часы, контакты, без курсов.
// Данные © OpenStreetMap contributors, ODbL — подпись на карте обязательна (SPEC: «Атрибуция»).

import { parseOpeningHours } from '../opening-hours.js';
import { USER_AGENT } from '../probe.js';
import { isCryptoName, safeWebsite, type AdapterResult, type NormalizedExchanger } from './types.js';

export const SOURCE = 'osm';
/** Список меняется редко — пересобираем раз в неделю (SPEC: «Архитектура»). */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

function address(tags: Record<string, string>): string {
  const street = tags['addr:street'] ?? tags['addr:place'];
  if (!street) return '';
  const line = [street, tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return city ? `${line}, ${city}` : line;
}

export function parseOverpass(json: { elements: OsmElement[] }, citySlug: string, cityName: string): AdapterResult {
  const exchangers: NormalizedExchanger[] = [];
  for (const el of json.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const tags = el.tags ?? {};
    // Криптоматы размечены в OSM тем же тегом, но это не обмен наличной валюты.
    // Тег currency:XBT сам по себе не признак: обычные kantory тоже бывают с ним.
    const machine = tags.vending !== undefined || tags.atm === 'yes';
    if (isCryptoName(`${tags.name ?? ''} ${tags.brand ?? ''} ${tags.operator ?? ''}`) || (machine && tags['currency:XBT'] === 'yes')) continue;
    const osmId = `${el.type[0]}${el.id}`;
    exchangers.push({
      id: `pl-${citySlug}-${SOURCE}-${osmId}`,
      country: 'PL',
      city: cityName,
      name: tags.name?.trim() || tags.brand?.trim() || 'Kantor',
      bank: null,
      address: address(tags),
      lat,
      lng,
      coordsSource: 'source',
      hours: parseOpeningHours(tags.opening_hours),
      sourceIds: { [SOURCE]: osmId },
      phone: (tags.phone ?? tags['contact:phone'])?.split(';')[0]?.trim() || null,
      website: safeWebsite(tags.website ?? tags['contact:website']),
    });
  }
  return { exchangers, rates: [] };
}

export async function fetchOsm(cityName: string): Promise<AdapterResult> {
  const name = cityName.replace(/"/g, '');
  const query = `[out:json][timeout:60];
area["boundary"="administrative"]["name"="${name}"]["admin_level"~"^(6|7|8)$"]->.city;
nwr["amenity"="bureau_de_change"](area.city);
out center tags;`;
  let json: { elements?: OsmElement[] } | null = null;
  const errors: string[] = [];
  // Публичные серверы Overpass бывают перегружены (504) — пробуем следующий.
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      json = (await response.json()) as { elements?: OsmElement[] };
      break;
    } catch (err) {
      errors.push(`${new URL(endpoint).host}: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!json) throw new Error(`Overpass: ${errors.join('; ')}`);
  if (!Array.isArray(json.elements)) throw new Error('Overpass: в ответе нет elements');
  return parseOverpass({ elements: json.elements }, slugify(cityName), cityName);
}
