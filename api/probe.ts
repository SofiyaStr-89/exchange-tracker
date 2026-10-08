// GET /api/probe?token=… — пробные запросы к источникам с серверов Vercel (шаг 2.3).
// Защищён токеном из переменной окружения PROBE_TOKEN: каждый вызов — 7 запросов к чужим сайтам.

import { probeAll } from '../lib/probe.js';

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.PROBE_TOKEN;
  if (!expected) return Response.json({ error: 'probe disabled: PROBE_TOKEN is not set' }, { status: 503 });
  const token = new URL(request.url).searchParams.get('token');
  if (token !== expected) return Response.json({ error: 'forbidden' }, { status: 403 });

  const results = await probeAll();
  return Response.json({
    runner: 'vercel',
    region: process.env.VERCEL_REGION ?? null,
    time: new Date().toISOString(),
    results,
  });
}
