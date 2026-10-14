// Перепроверка геокодированных точек Беларуси: Nominatim без проверки улицы и номера иногда возвращал чужой дом
// (Брест, ВТБ «Московская, 208-1» — в 4 км). Теперь точка принимается только с совпавшими улицей и номером.
// Расходится больше MOVE_M — ставим проверенную. Не нашлась с проверкой — оставляем как есть (в отчёт).
// npm run recheck-by [-- --dry]

import { and, eq } from 'drizzle-orm';
import { CITIES } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { distanceMeters } from '../lib/geo.js';
import { geocodeNominatimBy } from '../lib/geocode.js';
import { byAddressKey } from '../lib/onliner.js';

const MOVE_M = 300;
/** Проверенная точка дальше этого от центра города — чужой одноимённый адрес («Свислочская» → посёлок Свислочь). */
const cityRadius = (city: string) => (city === 'Минск' ? 15_000 : 10_000);
const PAUSE_MS = 1100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const dry = process.argv.includes('--dry');

const db = getDb();
const rows = await db
  .select({ id: exchangers.id, city: exchangers.city, address: exchangers.address, lat: exchangers.lat, lng: exchangers.lng })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'BY'), eq(exchangers.coordsSource, 'geocoder')));

const stats = { checked: 0, ok: 0, moved: 0, unconfirmed: 0, noKey: 0 };
const cache = new Map<string, { lat: number; lng: number } | null>();
for (const r of rows) {
  const key = byAddressKey(r.address);
  // «ул. Юбилейная, 4, д. ЦНА» — деревня под городом; ключ без неё найдёт одноимённую улицу в самом городе.
  if (!key || /(^|[\s,])(д|дер|аг|пос|п|гп)\.\s*[А-ЯЁ]/u.test(r.address)) {
    stats.noKey++;
    continue;
  }
  const cacheKey = `${r.city}|${key}`;
  const center = CITIES.find((c) => c.country === 'BY' && c.name === r.city);
  const inCity = (p: { lat: number; lng: number } | null) => (p && center && distanceMeters(p, center) <= cityRadius(r.city) ? p : null);
  if (!cache.has(cacheKey)) {
    // Адрес как есть, затем короткий ключ («московская 208, Брест» — так находится «ул. Московская, 208-1»).
    await sleep(PAUSE_MS);
    let found = inCity(await geocodeNominatimBy(r.address, r.city));
    if (!found) {
      await sleep(PAUSE_MS);
      found = inCity(await geocodeNominatimBy(key, r.city));
    }
    cache.set(cacheKey, found);
  }
  const point = cache.get(cacheKey);
  stats.checked++;
  if (!point) {
    stats.unconfirmed++;
    continue;
  }
  const off = distanceMeters(point, { lat: r.lat!, lng: r.lng! });
  if (off <= MOVE_M) {
    stats.ok++;
    continue;
  }
  stats.moved++;
  console.log(`↦ ${Math.round(off)} м: ${r.address} (${r.lat!.toFixed(5)}, ${r.lng!.toFixed(5)} → ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
  if (!dry) await db.update(exchangers).set({ lat: point.lat, lng: point.lng }).where(eq(exchangers.id, r.id));
}
console.log(`Итог${dry ? ' (без записи)' : ''}:`, stats);
