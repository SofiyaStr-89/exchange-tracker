// Запрос к публичным серверам Overpass (OpenStreetMap). Они бывают перегружены (504, таймаут) — пробуем следующий.

import { USER_AGENT } from './probe.js';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function overpass(query: string, timeoutMs = 90_000): Promise<OsmElement[]> {
  const errors: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as { elements?: OsmElement[] };
      if (!Array.isArray(json.elements)) throw new Error('в ответе нет elements');
      return json.elements;
    } catch (err) {
      errors.push(`${new URL(endpoint).host}: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`Overpass: ${errors.join('; ')}`);
}
