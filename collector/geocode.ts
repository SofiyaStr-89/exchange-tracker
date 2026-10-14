// Координаты для обменников, у которых их нет (правило склейки 3), найденное хранится в базе навсегда.
// Польша: GUGiK → Nominatim. Беларусь: kurs.onliner.by (Минск, по ключу адреса) → Nominatim.
// npm run geocode. Запросы последовательные, с паузой.

import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { CITIES } from '../lib/cities.js';
import { distanceMeters } from '../lib/geo.js';
import { byQueries, geocodeGugik, geocodeGugikLoose, geocodeIntersection, geocodeNominatimQuery, geocodeNominatim, geocodePhoton, intersectionStreets, geocodeNominatimBy, geocodePlaceBy, parsePolishAddress, placeNamesFromAddress, type Point } from '../lib/geocode.js';
import { addressKey } from '../lib/merge.js';
import { findTwin } from '../lib/twins.js';
import { byAddressKey, fetchOnlinerPoints } from '../lib/onliner.js';

const PAUSE_MS = 1100; // Nominatim: не больше 1 запроса в секунду
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const db = getDb();
// ——— Польша ———
const missing = await db
  .select({ id: exchangers.id, name: exchangers.name, city: exchangers.city, address: exchangers.address })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'PL'), isNull(exchangers.lat)));

const cache = new Map<string, { point: Point | null; via: string }>();
const stats = { gugik: 0, other: 0, notFound: 0, noNumber: 0, twin: 0 };

// Сосед по адресу: у другого источника тот же kantor уже с координатами (Sprawa без индекса — у kursarz и OSM).
const placed = await db
  .select({ name: exchangers.name, city: exchangers.city, address: exchangers.address, lat: exchangers.lat, lng: exchangers.lng })
  .from(exchangers)
  .where(and(eq(exchangers.country, 'PL'), isNotNull(exchangers.lat)));
const twinKey = (city: string, address: string) => {
  const k = addressKey(address);
  return k ? `${city.toLowerCase()}|${k}` : '';
};
const twins = new Map<string, Point>();
for (const p of placed) {
  const k = twinKey(p.city, p.address);
  if (k && !twins.has(k)) twins.set(k, { lat: p.lat!, lng: p.lng! });
}

for (const { id, name, city, address } of missing) {
  // Тот же kantor в другом источнике с другой записью адреса («Rondo Dmowskiego - Lokal 33»).
  const named = twins.get(twinKey(city, address)) ? null : findTwin({ name, city, address }, placed);
  if (named) {
    await db.update(exchangers).set({ lat: named.lat, lng: named.lng, coordsSource: 'geocoder' }).where(eq(exchangers.id, id));
    stats.twin++;
    console.log(`↔ двойник по названию: ${name} (${address}) → ${named.name} (${named.address})`);
    continue;
  }
  const twin = twins.get(twinKey(city, address));
  if (twin) {
    await db.update(exchangers).set({ lat: twin.lat, lng: twin.lng, coordsSource: 'geocoder' }).where(eq(exchangers.id, id));
    stats.twin++;
    console.log(`↔ по соседу с тем же адресом: ${address} → ${twin.lat.toFixed(5)}, ${twin.lng.toFixed(5)}`);
    continue;
  }
  // «Al. Jerozolimskie / E. Plater» — перекрёсток, а не дом.
  const crossing = intersectionStreets(address);
  const parsed = crossing ? null : parsePolishAddress(address);
  if (!parsed && !crossing) {
    stats.noNumber++;
    console.log(`— без номера дома, пропускаю: ${address}`);
    continue;
  }
  const center = CITIES.find((c) => c.country === 'PL' && c.name === city);
  const key = parsed ? `${parsed.city}|${parsed.street}|${parsed.number}` : `${city}|${crossing!.join('|')}`;
  let found = cache.get(key);
  if (!found && !parsed) {
    await sleep(PAUSE_MS);
    found = { point: await geocodeIntersection(address, city, center), via: 'Photon, перекрёсток' };
    cache.set(key, found);
  }
  if (!found && parsed) {
    await sleep(PAUSE_MS);
    let point = await geocodeGugik(parsed);
    let via = 'GUGiK';
    if (!point) {
      await sleep(PAUSE_MS);
      point = await geocodeGugikLoose(parsed);
      via = 'GUGiK без индекса';
    }
    // Без индекса Nominatim может найти одноимённую улицу в другом районе — не рискуем.
    if (!point && parsed.postalCode) {
      await sleep(PAUSE_MS);
      point = await geocodeNominatim(parsed);
      via = 'Nominatim';
    }
    // Последний шанс — Photon: терпит опечатки («Broniewskego») и номера вида «60/64».
    if (!point) {
      await sleep(PAUSE_MS);
      point = await geocodePhoton(parsed, center);
      via = 'Photon';
    }
    found = { point, via };
    cache.set(key, found);
  }
  if (!found?.point) {
    stats.notFound++;
    console.log(`✗ не найден: ${address}`);
    continue;
  }
  const point = found.point;
  await db
    .update(exchangers)
    .set({ lat: point.lat, lng: point.lng, coordsSource: 'geocoder' })
    .where(eq(exchangers.id, id));
  if (found.via === 'GUGiK') stats.gugik++;
  else stats.other++;
  console.log(`✓ ${found.via}: ${address} → ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
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
  for (const { id, address, city: rawCity } of missingBy) {
    // Город записи бывает испорчен адресом myfin («», «Минск ул. Воронянского») — тогда город из id (by-minsk-…).
    const byId = CITIES.find((c) => c.country === 'BY' && id.startsWith(`${c.id}-`));
    const city = CITIES.some((c) => c.country === 'BY' && c.name === rawCity) ? rawCity : (byId?.name ?? rawCity);
    const center = CITIES.find((c) => c.country === 'BY' && c.name === city);
    if (!center) {
      statsBy.notFound++;
      console.log(`✗ неизвестный город «${rawCity}», не геокодирую: ${address}`);
      continue;
    }
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
    // Нестандартная запись («Независимости пр., 23», «П. Глебки ул., 5») — пробуем упрощённый адрес «глебки 5».
    const key = byAddressKey(address);
    if (!point && key) {
      const cacheKey = `key|${key}|${city}`;
      if (!cacheBy.has(cacheKey)) {
        await sleep(PAUSE_MS);
        cacheBy.set(cacheKey, await geocodeNominatimBy(key, city));
      }
      point = cacheBy.get(cacheKey) ?? null;
      if (point) via = `Nominatim (адрес «${key}»)`;
    }
    // Адрес без улицы с номером (ТЦ за МКАД) — ищем сам ТЦ по названию из кавычек.
    for (const place of point ? [] : placeNamesFromAddress(address)) {
      const placeKey = `place|${place}|${city}`;
      if (!cacheBy.has(placeKey)) {
        await sleep(PAUSE_MS);
        cacheBy.set(placeKey, await geocodePlaceBy(place, city));
      }
      point = cacheBy.get(placeKey) ?? null;
      via = `Nominatim (место «${place}»)`;
      if (point) break;
    }
    // Нестандартная запись: сокращения, латиница в русском слове, место в скобках, километр шоссе.
    for (const q of point ? [] : byQueries(address, city)) {
      const qKey = `q|${q}`;
      if (!cacheBy.has(qKey)) {
        await sleep(PAUSE_MS);
        cacheBy.set(qKey, await geocodeNominatimQuery(q, byAddressKey(address)));
      }
      point = cacheBy.get(qKey) ?? null;
      via = `Nominatim («${q}»)`;
      if (point) break;
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
    if (via.startsWith('Nominatim (')) console.log(`✓ ${via}: ${address}`);
  }
  console.log(`Беларусь: без координат было ${missingBy.length}.`, statsBy);
}
