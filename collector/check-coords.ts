// Сверка координат источников с адресом (Польша): kantor.live и marketportal присылают точку вместе с адресом,
// и иногда точка не там (Galeria Ursynów на Al. KEN 36 стояла у Jana Pawła II). Адрес ищем в GUGiK
// (официальные адресные точки); если точка источника дальше MAX_OFF_M — ставим точку адреса.
// Nominatim здесь не используем: поправлять можно только точной точкой. Каждая точка сверяется один раз
// (coords_checked_at; при смене адреса источником — заново).
// npm run check-coords [-- <сколько точек>] [-- --dry]

import { and, eq, isNotNull, isNull, notLike } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers } from '../lib/db/schema.js';
import { distanceMeters } from '../lib/geo.js';
import { geocodeGugik, geocodeGugikLoose, parsePolishAddress } from '../lib/geocode.js';

/** Меньшие расхождения — обычно торговый центр: точка адреса у входа, источник точнее ставит сам kantor. */
const MAX_OFF_M = 500;
const PAUSE_MS = 1100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const dry = process.argv.includes('--dry');
const limit = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 1000);

const db = getDb();
const todo = await db
  .select({ id: exchangers.id, name: exchangers.name, address: exchangers.address, lat: exchangers.lat, lng: exchangers.lng })
  .from(exchangers)
  .where(
    and(
      eq(exchangers.country, 'PL'),
      eq(exchangers.coordsSource, 'source'),
      notLike(exchangers.id, '%-osm-%'), // точки OSM ставят руками на карте, адрес у них часто неполный
      isNotNull(exchangers.lat),
      isNull(exchangers.coordsCheckedAt),
    ),
  )
  .limit(limit);

const stats = { ok: 0, moved: 0, notFound: 0, noNumber: 0 };
const markChecked = (id: string, set: Partial<typeof exchangers.$inferInsert> = {}) =>
  dry ? Promise.resolve() : db.update(exchangers).set({ ...set, coordsCheckedAt: new Date() }).where(eq(exchangers.id, id));

console.log(`Точек для сверки: ${todo.length}${dry ? ' (без записи)' : ''}`);
for (const e of todo) {
  const parsed = parsePolishAddress(e.address);
  if (!parsed) {
    stats.noNumber++;
    await markChecked(e.id);
    continue;
  }
  await sleep(PAUSE_MS);
  let point = await geocodeGugik(parsed);
  if (!point) {
    await sleep(PAUSE_MS);
    point = await geocodeGugikLoose(parsed);
  }
  if (!point) {
    stats.notFound++;
    await markChecked(e.id);
    continue;
  }
  const off = Math.round(distanceMeters({ lat: e.lat!, lng: e.lng! }, point));
  if (off <= MAX_OFF_M) {
    stats.ok++;
    await markChecked(e.id);
    continue;
  }
  stats.moved++;
  console.log(`↦ ${off} м: ${e.name} — ${e.address} (${e.lat!.toFixed(5)}, ${e.lng!.toFixed(5)} → ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`);
  await markChecked(e.id, { lat: point.lat, lng: point.lng, coordsSource: 'address' });
}
console.log('Итог:', stats);
