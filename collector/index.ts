// Ручной сбор одного города: npm run collect -- <источник> <город>, например kantorlive warszawa.
// Нужен DATABASE_URL (локально — в .env.local).

import { collectCity, ADAPTERS } from '../lib/collect.js';
import { getDb } from '../lib/db/index.js';

const [source, city] = process.argv.slice(2);
if (!source || !city) {
  console.error(`Использование: npm run collect -- <источник> <город>. Источники: ${Object.keys(ADAPTERS).join(', ')}`);
  process.exit(1);
}

const outcome = await collectCity(getDb(), source, city);
console.log(`${source} / ${city}:`, outcome);
if (outcome.status === 'error') process.exit(1);
