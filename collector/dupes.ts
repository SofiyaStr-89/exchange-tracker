// Поиск возможных несклеенных дублей: точки разных источников ближе 60 м друг к другу после склейки.
// npm run dupes — для ручной проверки правила склейки 1.

import { CITIES } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { loadInBounds } from '../lib/exchangers.js';
import { distanceMeters } from '../lib/geo.js';

const city = CITIES.find((c) => c.id === (process.argv[2] ?? 'pl-warszawa'))!;
const d = 0.089;
const { inView } = await loadInBounds(
  getDb(),
  { south: city.lat - d, north: city.lat + d, west: city.lng - d / Math.cos((city.lat * Math.PI) / 180), east: city.lng + d / Math.cos((city.lat * Math.PI) / 180) },
  'USD',
);
let n = 0;
for (let i = 0; i < inView.length; i++) {
  for (let j = i + 1; j < inView.length; j++) {
    const a = inView[i]!;
    const b = inView[j]!;
    const m = distanceMeters(a, b);
    if (m <= 60 && a.sources.join() !== b.sources.join()) {
      n++;
      console.log(`${Math.round(m)} м | ${a.name} [${a.sources}] | ${b.name} [${b.sources}] | ${a.address.slice(0, 40)} / ${b.address.slice(0, 40)}`);
    }
  }
}
console.log(`пар рядом из разных источников: ${n}`);
