import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry, MAX_RETRY_WAIT_MS, retryAfterMs } from '../lib/retry.js';

const reply = (status: number, headers: Record<string, string> = {}) => new Response(status === 200 ? '{}' : 'x', { status, headers });

/** fetch отвечает по очереди заданными ответами; ожидание не настоящее — только записывается. */
function setup(...responses: (Response | Error)[]) {
  const queue = [...responses];
  const fetchSpy = vi.fn(async () => {
    const next = queue.shift()!;
    if (next instanceof Error) throw next;
    return next;
  });
  vi.stubGlobal('fetch', fetchSpy);
  const waits: number[] = [];
  const sleep = async (ms: number) => void waits.push(ms);
  return { fetchSpy, waits, sleep };
}

afterEach(() => vi.unstubAllGlobals());

describe('повтор при временном сбое источника', () => {
  it('429, затем 200 — успех после паузы по умолчанию', async () => {
    const { fetchSpy, waits, sleep } = setup(reply(429), reply(200));
    const res = await fetchWithRetry('https://x', () => ({}), { sleep });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([5_000]);
  });

  it('Retry-After в секундах учитывается', async () => {
    const { waits, sleep } = setup(reply(429, { 'Retry-After': '3' }), reply(200));
    expect((await fetchWithRetry('https://x', () => ({}), { sleep })).status).toBe(200);
    expect(waits).toEqual([3_000]);
  });

  it('Retry-After дольше лимита ожидания — не ждём, отдаём 429', async () => {
    const { fetchSpy, waits, sleep } = setup(reply(429, { 'Retry-After': '120' }), reply(200));
    expect((await fetchWithRetry('https://x', () => ({}), { sleep })).status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it('5xx до исчерпания попыток — последний ответ, суммарное ожидание в пределах лимита', async () => {
    const { fetchSpy, waits, sleep } = setup(reply(503), reply(502), reply(500));
    expect((await fetchWithRetry('https://x', () => ({}), { sleep })).status).toBe(500);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(waits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(MAX_RETRY_WAIT_MS);
  });

  it('404 и другие 4xx не повторяются', async () => {
    const { fetchSpy, sleep } = setup(reply(404), reply(200));
    expect((await fetchWithRetry('https://x', () => ({}), { sleep })).status).toBe(404);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('обрыв сети: повтор, затем успех; все попытки упали — ошибка', async () => {
    const ok = setup(new TypeError('fetch failed'), reply(200));
    expect((await fetchWithRetry('https://x', () => ({}), { sleep: ok.sleep })).status).toBe(200);
    const bad = setup(new TypeError('fetch failed'), new TypeError('fetch failed'), new TypeError('fetch failed'));
    await expect(fetchWithRetry('https://x', () => ({}), { sleep: bad.sleep })).rejects.toThrow('fetch failed');
  });

  it('Retry-After как HTTP-дата', () => {
    const now = Date.parse('2026-10-22T10:00:00Z');
    expect(retryAfterMs('Thu, 22 Oct 2026 10:00:07 GMT', now)).toBe(7_000);
    expect(retryAfterMs('ерунда', now)).toBeNull();
  });
});

describe('kantor.live: повтор на 429', () => {
  it('fetchKantorLive переживает один ответ 429', async () => {
    vi.useFakeTimers();
    const { fetchKantorLive } = await import('../lib/adapters/kantorlive.js');
    const sample = readFileSync('tests/fixtures/kantorlive-sample.json', 'utf8');
    const { fetchSpy } = setup(reply(429), new Response(sample, { status: 200 }));
    const pending = fetchKantorLive('warszawa');
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;
    expect(result.exchangers.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
