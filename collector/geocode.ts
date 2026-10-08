// Координаты для польских обменников, у которых их нет (правило склейки 3): GUGiK → Nominatim.
// npm run geocode. Запросы последовательные, с паузой; найденное хранится в базе навсегда.

import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { geocodeGugik, geocodeNominatim, parsePolishAddress, type Point } from '../lib/geocode.js';

const PAUSE_MS = 1100; // Nominatim: не больше 1 запроса в секунду
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const db = getDb();
const missing = await db
  .select({ id: exchangers.id, address: exchangers.address })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'PL'), isNull(exchangers.lat)));

const cache = new Map<string, { point: Point | null; via: string }>();
const stats = { gugik: 0, nominatim: 0, notFound: 0, noNumber: 0 };

for (const { id, address } of missing) {
  const parsed = parsePolishAddress(address);
  if (!parsed) {
    stats.noNumber++;
    console.log(`— без номера дома, пропускаю: ${address}`);
    continue;
  }
  const key = `${parsed.city}|${parsed.street}|${parsed.number}`;
  let found = cache.get(key);
  if (!found) {
    await sleep(PAUSE_MS);
    let point = await geocodeGugik(parsed);
    let via = 'GUGiK';
    if (!point) {
      await sleep(PAUSE_MS);
      point = await geocodeNominatim(parsed);
      via = 'Nominatim';
    }
    found = { point, via };
    cache.set(key, found);
  }
  if (!found.point) {
    stats.notFound++;
    console.log(`✗ не найден: ${address}`);
    continue;
  }
  await db
    .update(exchangers)
    .set({ lat: found.point.lat, lng: found.point.lng, coordsSource: 'geocoder' })
    .where(eq(exchangers.id, id));
  if (found.via === 'GUGiK') stats.gugik++;
  else stats.nominatim++;
  console.log(`✓ ${found.via}: ${address} → ${found.point.lat.toFixed(5)}, ${found.point.lng.toFixed(5)}`);
}

console.log(`Без координат было: ${missing.length}.`, stats);
