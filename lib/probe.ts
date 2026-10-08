// Пробник источников (шаг 2.3): по одному запросу к каждому источнику, чтобы понять,
// отвечают ли они с серверов Vercel и GitHub (не из Польши/Беларуси) и не прячутся ли за капчей.

export const USER_AGENT =
  'ExchangeMapBot/0.1 (personal non-commercial project; https://github.com/SofiyaStr-89/exchange-tracker)';

export interface ProbeTarget {
  source: string;
  url: string;
  /** Признак того, что пришли настоящие данные, а не заглушка или капча. */
  marker: RegExp;
}

export const PROBE_TARGETS: ProbeTarget[] = [
  {
    source: 'kantorlive',
    url: 'https://kantor.live/api/v1/kantors?city=warszawa&per_page=1000&locale=pl',
    marker: /"slug":/g,
  },
  { source: 'zlata', url: 'https://zlata.ws/pl/kantory/warszawa/', marker: /\b\d\d\.\d\d \d\d:\d\d\b/g },
  { source: 'marketportal', url: 'https://marketportal.pl/kantory/warszawa', marker: /Ostatnia aktualizacja/g },
  { source: 'myfin', url: 'https://myfin.by/currency/minsk', marker: /data-branch-converter/g },
  {
    source: 'belarusbank',
    url: 'https://belarusbank.by/api/kursExchange?city=' + encodeURIComponent('Минск'),
    marker: /"kurs_date_time"/g,
  },
  { source: 'mtbank', url: 'https://www.mtbank.by/currxml.php?ver=2', marker: /<department\b/g },
  { source: 'onliner', url: 'https://kurs.onliner.by/', marker: /data-latitude/g },
];

export interface ProbeResult {
  source: string;
  url: string;
  ok: boolean;
  status: number | null;
  ms: number;
  bytes: number;
  /** Сколько раз встретился маркер данных: 0 при капче, блокировке или смене вёрстки. */
  markerCount: number;
  /** Время на поиск маркера по ответу — грубая оценка стоимости разбора. */
  scanMs: number;
  blocked: string | null;
  error: string | null;
}

const PAUSE_MS = 1500;
const TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function detectBlock(status: number, headers: Headers, body: string): string | null {
  if (headers.get('cf-mitigated')) return `cf-mitigated: ${headers.get('cf-mitigated')}`;
  if (/just a moment|cf-challenge|captcha|access denied/i.test(body.slice(0, 20_000))) {
    return 'страница-заглушка (капча или запрет доступа)';
  }
  if (status === 403 || status === 429 || status === 451) return `HTTP ${status}`;
  return null;
}

export async function probeOne(target: ProbeTarget): Promise<ProbeResult> {
  const started = performance.now();
  const base = { source: target.source, url: target.url };
  try {
    const response = await fetch(target.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow',
    });
    const body = await response.text();
    const ms = Math.round(performance.now() - started);
    const scanStarted = performance.now();
    const markerCount = body.match(target.marker)?.length ?? 0;
    const scanMs = Math.round((performance.now() - scanStarted) * 10) / 10;
    const blocked = detectBlock(response.status, response.headers, body);
    return {
      ...base,
      ok: response.ok && markerCount > 0 && !blocked,
      status: response.status,
      ms,
      bytes: Buffer.byteLength(body),
      markerCount,
      scanMs,
      blocked,
      error: null,
    };
  } catch (err) {
    return {
      ...base,
      ok: false,
      status: null,
      ms: Math.round(performance.now() - started),
      bytes: 0,
      markerCount: 0,
      scanMs: 0,
      blocked: null,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

/** Последовательно, с паузой между запросами (SPEC: «Вежливость к источникам»). */
export async function probeAll(targets: ProbeTarget[] = PROBE_TARGETS): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const [i, target] of targets.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    results.push(await probeOne(target));
  }
  return results;
}

export function formatTable(results: ProbeResult[]): string {
  const rows = results.map((r) =>
    [
      r.ok ? '✅' : '❌',
      r.source,
      r.status ?? '—',
      `${r.ms} мс`,
      `${Math.round(r.bytes / 1024)} КБ`,
      r.markerCount,
      `${r.scanMs} мс`,
      r.blocked ?? r.error ?? '',
    ].join(' | '),
  );
  return [
    '| | Источник | HTTP | Время | Размер | Маркер | Поиск маркера | Проблема |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row} |`),
  ].join('\n');
}
