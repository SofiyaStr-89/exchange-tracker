// Сверка уже записанных курсов с NBP (правило склейки 7) без запросов к источникам:
// неправдоподобная сторона обнуляется, курс без правдоподобных сторон удаляется.
// npm run sanitize-db

import { and, eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { rates } from '../lib/db/schema.js';
import { sanitizeRate } from '../lib/extract-rates.js';
import { loadNbpMids } from '../lib/nbp.js';

const db = getDb();
const mids = await loadNbpMids();
const all = await db.select().from(rates);
let fixed = 0;
let removed = 0;
for (const r of all) {
  const clean = sanitizeRate(r.currency, r.buy, r.sell, mids);
  const key = and(eq(rates.exchangerId, r.exchangerId), eq(rates.currency, r.currency), eq(rates.source, r.source));
  if (!clean) {
    await db.delete(rates).where(key);
    removed++;
    console.log(`удалён ${r.source} ${r.exchangerId} ${r.currency} ${r.buy}/${r.sell}`);
  } else if (clean.buy !== r.buy || clean.sell !== r.sell) {
    await db.update(rates).set(clean).where(key);
    fixed++;
    console.log(`исправлен ${r.source} ${r.exchangerId} ${r.currency} ${r.buy}/${r.sell} → ${clean.buy}/${clean.sell}`);
  }
}
console.log(`Проверено курсов: ${all.length}, исправлено: ${fixed}, удалено: ${removed}`);
