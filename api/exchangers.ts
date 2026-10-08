// POST /api/exchangers {lat, lng, radius} — обменники в радиусе + 3 ближайших за ним (SPEC: «API», FR-9).
// Координаты передаются в теле, а не в адресе: адреса запросов попадают в журнал Vercel,
// а координаты пользователя не должны сохраняться и писаться в логи (SPEC: «Приватность»).

import { waitUntil } from '@vercel/functions';
import { citiesNear } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { loadNearby, MAX_RADIUS_M } from '../lib/exchangers.js';
import { planRefresh, runCollects } from '../lib/refresh.js';

const DEFAULT_RADIUS_M = 500;

function parseBody(body: unknown): { lat: number; lng: number; radius: number } | null {
  if (!body || typeof body !== 'object') return null;
  const { lat, lng, radius = DEFAULT_RADIUS_M } = body as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radius !== 'number') return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS_M) return null;
  return { lat, lng, radius };
}

export async function POST(request: Request): Promise<Response> {
  const query = parseBody(await request.json().catch(() => null));
  if (!query) {
    return Response.json(
      { error: `в теле нужен JSON {lat, lng, radius} с radius до ${MAX_RADIUS_M} м` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const center = { lat: query.lat, lng: query.lng };
  const db = getDb();

  const plan = await planRefresh(db, citiesNear(center));
  if (plan.firstTime.length) await runCollects(db, plan.firstTime);
  if (plan.stale.length) waitUntil(runCollects(db, plan.stale));

  const { inRadius, nearest } = await loadNearby(db, center, query.radius);
  return Response.json(
    {
      radius: query.radius,
      refreshing: plan.stale.length > 0,
      dataFetchedAt: plan.firstTime.length ? new Date() : plan.oldestFetchedAt,
      exchangers: inRadius,
      nearest,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
