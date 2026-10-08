// GET /api/health — состояние сервиса и адаптеров источников (SPEC: «API»).
// Адаптеров пока нет, поэтому список источников пустой.

export interface SourceHealth {
  source: string;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export function GET(): Response {
  const sources: SourceHealth[] = [];
  return Response.json({ status: 'ok', time: new Date().toISOString(), sources });
}
