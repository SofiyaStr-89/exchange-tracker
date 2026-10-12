// Еженедельная пересборка (SPEC: «Архитектура»): списки обменников из OSM для городов, которые уже открывали.
// npm run weekly. Между запросами к Overpass — пауза.

import { eq } from 'drizzle-orm';
import { collectCity } from '../lib/collect.js';
import { getDb } from '../lib/db/index.js';
import { cityFetches } from '../lib/db/schema.js';

const PAUSE_MS = 10_000;
const db = getDb();
const visited = await db.selectDistinct({ city: cityFetches.city }).from(cityFetches).where(eq(cityFetches.source, 'osm'));
for (const [i, { city }] of visited.entries()) {
  if (i) await new Promise((r) => setTimeout(r, PAUSE_MS));
  console.log(`osm / ${city}:`, await collectCity(db, 'osm', city));
}
