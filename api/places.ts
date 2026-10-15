// POST /api/places {q, near?: {lat, lng}} — населённые пункты и районы городов по началу любого варианта названия
// (FR-26). Набранное и центр карты — в теле, а не в адресе: адреса запросов попадают в журнал Vercel.

import { desc, like } from 'drizzle-orm';
import { getDb } from '../lib/db/index.js';
import { places } from '../lib/db/schema.js';
import { distanceMeters } from '../lib/geo.js';
import { normalizePlace, placeLabel, placeScore } from '../lib/places.js';

const LIMIT = 6;
const COUNTRY_NAME = { PL: 'Польша', BY: 'Беларусь' } as const;

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { q?: unknown; near?: { lat?: unknown; lng?: unknown } } | null;
  const q = typeof body?.q === 'string' ? normalizePlace(body.q).slice(0, 60) : '';
  if (q.length < 2) return Response.json({ places: [] });
  const near =
    typeof body?.near?.lat === 'number' && typeof body.near.lng === 'number' ? { lat: body.near.lat, lng: body.near.lng } : null;
  // «|колодищ…»: начало любого варианта названия; % и _ — не спецсимволы для пользователя.
  const pattern = `%|${q.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`;
  const rows = await getDb()
    .select()
    .from(places)
    .where(like(places.search, pattern))
    .orderBy(desc(places.population))
    .limit(60);
  const ranked = rows
    .map((r) => ({ r, score: placeScore(r.population, near ? distanceMeters(near, r) / 1000 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT)
    .map(({ r }) => ({
      label: placeLabel(r.names, r.name, typeof body?.q === 'string' ? body.q : ''),
      // Расстояние от центра карты различает деревни-тёзки (несколько Piaseczno).
      detail: near ? `${COUNTRY_NAME[r.country]} · ${Math.round(distanceMeters(near, r) / 1000)} км` : COUNTRY_NAME[r.country],
      lat: r.lat,
      lng: r.lng,
    }));
  return Response.json({ places: ranked }, { headers: { 'Cache-Control': 'no-store' } });
}
