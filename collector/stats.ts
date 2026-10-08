// Покрытие города после склейки: npm run stats [-- <город из lib/cities.ts>] (по умолчанию pl-warszawa).
// Сколько обменников на карте, у скольких есть курс и из каких источников они склеены.

import { CITIES } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { loadInBounds } from '../lib/exchangers.js';

const cityId = process.argv[2] ?? 'pl-warszawa';
const city = CITIES.find((c) => c.id === cityId);
if (!city) throw new Error(`Нет города ${cityId}. Есть: ${CITIES.map((c) => c.id).join(', ')}`);

// Квадрат 20×20 км вокруг центра — максимум, который отдаёт API.
const dLat = 0.089;
const dLng = dLat / Math.cos((city.lat * Math.PI) / 180);
const bounds = { south: city.lat - dLat, north: city.lat + dLat, west: city.lng - dLng, east: city.lng + dLng };
const { inView } = await loadInBounds(getDb(), bounds, 'USD');

const bySources: Record<string, number> = {};
for (const e of inView) bySources[e.sources.join('+')] = (bySources[e.sources.join('+')] ?? 0) + 1;
const withRate = inView.filter((e) => Object.keys(e.rates).length > 0);

console.log(`${city.name}: обменников на карте ${inView.length}, с курсом ${withRate.length}, с курсом USD ${inView.filter((e) => e.rates.USD).length}`);
console.log('по источникам:', bySources);
