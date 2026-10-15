// GET /api/currencies?country=PL — валюты, которые реально есть в данных страны (FR-10),
// по убыванию числа обменников с этим курсом.

import { and, countDistinct, desc, eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers, goldPrices, rates } from '../lib/db/schema.js';
import { goldCode } from '../lib/gold.js';

const COUNTRIES = ['PL', 'BY'] as const;

export async function GET(request: Request): Promise<Response> {
  const country = new URL(request.url).searchParams.get('country');
  if (!COUNTRIES.includes(country as (typeof COUNTRIES)[number])) {
    return Response.json({ error: `country: ${COUNTRIES.join(' или ')}` }, { status: 400 });
  }
  const rows = await getDb()
    .select({ currency: rates.currency, exchangers: countDistinct(rates.exchangerId) })
    .from(rates)
    .innerJoin(exchangers, eq(exchangers.id, rates.exchangerId))
    .where(and(eq(exchangers.country, country as (typeof COUNTRIES)[number])))
    .groupBy(rates.currency)
    .orderBy(desc(countDistinct(rates.exchangerId)), rates.currency);
  // Золото — отдельными пунктами (проба за 1 г у kantorów, слитки по весу у банков Беларуси).
  const gold = await getDb()
    .select({ kind: goldPrices.kind, item: goldPrices.item, exchangers: countDistinct(goldPrices.owner) })
    .from(goldPrices)
    .where(eq(goldPrices.country, country as (typeof COUNTRIES)[number]))
    .groupBy(goldPrices.kind, goldPrices.item);
  const goldRows = gold
    .sort((a, b) => Number(b.kind === 'purity') - Number(a.kind === 'purity') || (a.kind === 'purity' ? Number(b.item) - Number(a.item) : Number(a.item) - Number(b.item)))
    .map((g) => ({ currency: goldCode(g.kind, g.item), exchangers: g.exchangers }));
  return Response.json(
    { country, currencies: [...rows, ...goldRows] },
    // Список меняется редко: телефону можно держать его час.
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
