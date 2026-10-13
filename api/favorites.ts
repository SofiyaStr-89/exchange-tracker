// POST /api/favorites {ids: [...]} — избранные обменники с текущими курсами (FR-34).
// Список id в теле, а не в адресе: по избранному видно, где человек бывает, а адреса запросов попадают в журнал Vercel.
// Устаревшие данные городов избранного обновляются в фоне, как и для карты.

import { waitUntil } from '@vercel/functions';
import { citiesNear, type City } from '../lib/cities.js';
import { getDb } from '../lib/db/index.js';
import { loadByIds } from '../lib/exchangers.js';
import { planRefresh, runCollects } from '../lib/refresh.js';

const MAX_IDS = 100;
/** Больше городов за раз не обновляем — фоновая работа функции ограничена по времени. */
const MAX_REFRESH_CITIES = 3;

const noStore = { 'Cache-Control': 'no-store' };

function parseIds(body: unknown): string[] | null {
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length > MAX_IDS) return null;
  if (!ids.every((id) => typeof id === 'string' && /^[a-z0-9-]{1,100}$/.test(id))) return null;
  return [...new Set(ids as string[])];
}

export async function POST(request: Request): Promise<Response> {
  const ids = parseIds(await request.json().catch(() => null));
  if (!ids) return Response.json({ error: `в теле нужен JSON {ids: [...]}, не больше ${MAX_IDS}` }, { status: 400, headers: noStore });
  const db = getDb();
  const list = await loadByIds(db, ids);

  const cities = new Map<string, City>();
  for (const e of list) for (const c of citiesNear(e)) cities.set(c.id, c);
  const plan = await planRefresh(db, [...cities.values()].slice(0, MAX_REFRESH_CITIES));
  const jobs = [...plan.firstTime, ...plan.stale];
  if (jobs.length) waitUntil(runCollects(db, jobs));

  return Response.json({ refreshing: jobs.length > 0, exchangers: list }, { headers: noStore });
}
