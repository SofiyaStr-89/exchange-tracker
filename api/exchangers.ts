// GET /api/exchangers?lat=&lng=&radius= — обменники в радиусе + 3 ближайших за ним (SPEC: «API», FR-9).
// Координаты пользователя нигде не сохраняются и не пишутся в лог (SPEC: «Приватность»).

import { waitUntil } from '@vercel/functions';
import { citiesNear } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { loadNearby, MAX_RADIUS_M } from '../lib/exchangers.js';
import { planRefresh, runCollects } from '../lib/refresh.js';

const DEFAULT_RADIUS_M = 500;

function parseQuery(url: URL): { lat: number; lng: number; radius: number } | null {
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  const radius = Number(url.searchParams.get('radius') ?? DEFAULT_RADIUS_M);
  if (!url.searchParams.has('lat') || !url.searchParams.has('lng')) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS_M) return null;
  return { lat, lng, radius };
}

export async function GET(request: Request): Promise<Response> {
  const query = parseQuery(new URL(request.url));
  if (!query) {
    return Response.json(
      { error: `нужны lat, lng и radius до ${MAX_RADIUS_M} м` },
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
