// GET /api/currencies?country=PL — валюты, которые реально есть в данных страны (FR-10),
// по убыванию числа обменников с этим курсом.

import { and, countDistinct, desc, eq } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { exchangers, rates } from '../lib/db/schema.js';

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
  return Response.json(
    { country, currencies: rows },
    // Список меняется редко: телефону можно держать его час.
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
