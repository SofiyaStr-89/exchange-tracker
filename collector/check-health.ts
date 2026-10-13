// Ночная проверка источников (SPEC: «оповещение о падении адаптера обязательно»): если источник сломан,
// шаг GitHub Actions завершается с ошибкой — GitHub присылает владельцу репозитория письмо.
// npm run check-health

import { CITIES } from '../lib/cities.js';
import { ADAPTERS } from '../lib/collect.js';
import { getDb } from '../lib/db/index.js';
import { cityFetches } from '../lib/db/schema.js';
import { FRESH_MS } from '../lib/exchangers.js';
import { brokenSources } from '../lib/health.js';

const rows = await getDb()
  .select({
    source: cityFetches.source,
    status: cityFetches.status,
    fetchedAt: cityFetches.fetchedAt,
    startedAt: cityFetches.startedAt,
    error: cityFetches.error,
  })
  .from(cityFetches);

// Только включённые источники: выключенный (например, Sprawa) не должен присылать письма.
const active = new Set(CITIES.flatMap((c) => Object.keys(c.sources)));
const broken = brokenSources(rows.filter((r) => active.has(r.source)), new Date(), (s) => ADAPTERS[s]?.maxAgeMs ?? FRESH_MS);
if (!broken.length) {
  console.log('Все источники работают.');
  process.exit(0);
}
for (const b of broken) {
  const since = b.lastSuccessAt ? `последний удачный сбор ${b.lastSuccessAt.toISOString()}` : 'удачных сборов не было';
  // ::error:: — строка видна в сводке запуска и в письме GitHub.
  console.log(`::error::Источник ${b.source} не работает (${since}): ${b.error}`);
}
process.exit(1);
