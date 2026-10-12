// Координаты для обменников, у которых их нет (правило склейки 3), найденное хранится в базе навсегда.
// Польша: GUGiK → Nominatim. Беларусь: kurs.onliner.by (Минск, по ключу адреса) → Nominatim.
// npm run geocode. Запросы последовательные, с паузой.

import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { CITIES } from '../lib/cities.js';
import { distanceMeters } from '../lib/geo.js';
import { geocodeGugik, geocodeNominatim, geocodeNominatimBy, parsePolishAddress, type Point } from '../lib/geocode.js';
import { byAddressKey, fetchOnlinerPoints } from '../lib/onliner.js';

const PAUSE_MS = 1100; // Nominatim: не больше 1 запроса в секунду
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const db = getDb();
// ——— Польша ———
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

// ——— Беларусь ———
const missingBy = await db
  .select({ id: exchangers.id, address: exchangers.address, city: exchangers.city })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'BY'), isNull(exchangers.lat)));

if (missingBy.length) {
  const statsBy = { onliner: 0, nominatim: 0, notFound: 0, farAway: 0 };
  // onliner знает только Минск.
  const onliner = missingBy.some((r) => r.city === 'Минск') ? await fetchOnlinerPoints() : [];
  const byKey = new Map<string, Point>();
  for (const p of onliner) {
    const k = byAddressKey(p.address);
    if (k && !byKey.has(k)) byKey.set(k, { lat: p.lat, lng: p.lng });
  }
  const cacheBy = new Map<string, Point | null>();
  for (const { id, address, city } of missingBy) {
    const center = CITIES.find((c) => c.name === city);
    let point = byKey.get(byAddressKey(address)) ?? null;
    let via = 'onliner';
    if (!point) {
      via = 'Nominatim';
      if (!cacheBy.has(address)) {
        await sleep(PAUSE_MS);
        cacheBy.set(address, await geocodeNominatimBy(address, city));
      }
      point = cacheBy.get(address) ?? null;
    }
    // Точка дальше 40 км от центра города — скорее чужой одноимённый адрес.
    if (point && center && distanceMeters(point, center) > 40_000) {
      statsBy.farAway++;
      console.log(`✗ слишком далеко от города (${via}): ${address}`);
      continue;
    }
    if (!point) {
      statsBy.notFound++;
      console.log(`✗ не найден: ${address}`);
      continue;
    }
    await db.update(exchangers).set({ lat: point.lat, lng: point.lng, coordsSource: 'geocoder' }).where(eq(exchangers.id, id));
    if (via === 'onliner') statsBy.onliner++;
    else statsBy.nominatim++;
  }
  console.log(`Беларусь: без координат было ${missingBy.length}.`, statsBy);
}
