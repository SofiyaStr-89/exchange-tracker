// POST /api/exchangers {bounds: {south, west, north, east}, currency} — обменники в видимой области карты
// + 3 ближайших за её пределами с курсом этой валюты (SPEC: «API», FR-3, FR-9).
// Координаты передаются в теле, а не в адресе: адреса запросов попадают в журнал Vercel,
// а местоположение пользователя не должно сохраняться и писаться в логи (SPEC: «Приватность»).

import { waitUntil } from '@vercel/functions';
import { citiesNear } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { boundsCenter, isTooLarge, MAX_SIDE_M, type Bounds } from '../lib/bounds.js';
import { loadInBounds } from '../lib/exchangers.js';
import { planRefresh, runCollects } from '../lib/refresh.js';

const isLat = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90;
const isLng = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180;

function parseBody(body: unknown): { bounds: Bounds; currency: string } | null {
  const { bounds, currency = 'USD' } = (body ?? {}) as { bounds?: Record<string, unknown>; currency?: unknown };
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;
  if (!bounds || typeof bounds !== 'object') return null;
  const { south, west, north, east } = bounds;
  if (!isLat(south) || !isLat(north) || !isLng(west) || !isLng(east)) return null;
  if (south >= north || west >= east) return null;
  const b = { south, west, north, east };
  return isTooLarge(b) ? null : { bounds: b, currency };
}

const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request): Promise<Response> {
  const query = parseBody(await request.json().catch(() => null));
  if (!query) {
    return Response.json(
      { error: `в теле нужен JSON {bounds: {south, west, north, east}, currency}, стороны не длиннее ${MAX_SIDE_M / 1000} км` },
      { status: 400, headers: noStore },
    );
  }
  const { bounds, currency } = query;
  const db = getDb();

  const plan = await planRefresh(db, citiesNear(boundsCenter(bounds)));
  if (plan.firstTime.length) await runCollects(db, plan.firstTime);
  if (plan.stale.length) waitUntil(runCollects(db, plan.stale));

  const { inView, nearest } = await loadInBounds(db, bounds, currency);
  return Response.json(
    {
      refreshing: plan.stale.length > 0,
      dataFetchedAt: plan.firstTime.length ? new Date() : plan.oldestFetchedAt,
      exchangers: inView,
      nearest,
    },
    { headers: noStore },
  );
}
