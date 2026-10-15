// Справочник мест для быстрых подсказок поиска (lib/places.ts): населённые пункты (класс P) из выгрузок GeoNames.
// Файлы: https://download.geonames.org/export/dump/BY.zip и PL.zip (CC BY 4.0) → BY.txt, PL.txt.
// npm run build-places -- <BY.txt> <PL.txt>. Меняется редко — пересобирать раз в несколько месяцев.

import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { places } from '../lib/db/schema.js';
import { placeVariants, searchKey } from '../lib/places.js';

const db = getDb();
for (const file of process.argv.slice(2)) {
  const rows = readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.split('\t'))
    .filter((f) => f[6] === 'P' && (f[8] === 'PL' || f[8] === 'BY'))
    .map((f) => {
      const names = placeVariants(f[1]!, f[2]!, f[3] ?? '');
      return {
        id: Number(f[0]),
        country: f[8] as 'PL' | 'BY',
        name: f[1]!,
        names,
        search: searchKey(names),
        lat: Number(f[4]),
        lng: Number(f[5]),
        population: Number(f[14]) || 0,
        kind: f[7]!,
      };
    })
    .filter((r) => r.names.length && Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (!rows.length) continue;
  const country = rows[0]!.country;
  await db.delete(places).where(eq(places.country, country));
  for (let i = 0; i < rows.length; i += 1000) await db.insert(places).values(rows.slice(i, i + 1000));
  console.log(`${country}: ${rows.length} мест`);
}
