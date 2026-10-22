// Повтор запроса при временном сбое источника (kantor.live иногда отвечает 429 Too Many Requests,
// на следующий день проходит): 429, 5xx, обрыв сети и таймаут — повторяем; 404 и прочие 4xx — нет.

/**
 * Суммарное ожидание между попытками. Сбор идёт в функции Vercel (лимит 60 с, vercel.json), а kantor.live —
 * основной источник: при первом открытии города пользователь ждёт именно его. Паузы по 30–90 с туда не влезают —
 * если источник просит ждать дольше, сдаёмся сразу: упавший источник и так переспросим через час (lib/refresh.ts).
 */
export const MAX_RETRY_WAIT_MS = 20_000;
/** Паузы без заголовка Retry-After: перед 1-м и 2-м повтором — вместе укладываются в MAX_RETRY_WAIT_MS. */
export const DEFAULT_DELAYS_MS = [5_000, 15_000];

export interface RetryOptions {
  delaysMs?: number[];
  maxWaitMs?: number;
  /** Подменяется в тестах, чтобы не ждать по-настоящему. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const retryable = (status: number) => status === 429 || status >= 500;

/** Retry-After: секунды («120») или HTTP-дата; непонятное — null. */
export function retryAfterMs(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const s = header.trim();
  if (/^\d+$/.test(s)) return Number(s) * 1000;
  const at = Date.parse(s);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/**
 * fetch с повторами. Возвращает последний ответ (вызывающий сам решает, что делать с не-ok),
 * при сетевой ошибке после всех попыток — бросает её.
 */
export async function fetchWithRetry(url: string, init: () => RequestInit, options: RetryOptions = {}): Promise<Response> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const maxWait = options.maxWaitMs ?? MAX_RETRY_WAIT_MS;
  const sleep = options.sleep ?? realSleep;
  const now = options.now ?? Date.now;
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    let error: unknown = null;
    try {
      // init() каждый раз заново: AbortSignal.timeout у каждой попытки свой.
      response = await fetch(url, init());
      if (!retryable(response.status)) return response;
    } catch (err) {
      error = err;
    }
    const pause = (response && retryAfterMs(response.headers.get('Retry-After'), now())) ?? delays[attempt];
    // Попытки кончились или ждать дольше бюджета — отдаём последний ответ / ошибку.
    if (attempt >= delays.length || pause === undefined || waited + pause > maxWait) {
      if (response) return response;
      throw error;
    }
    await sleep(pause);
    waited += pause;
  }
}
