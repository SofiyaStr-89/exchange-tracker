import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../api/probe.js';
import { probeOne, type ProbeTarget } from '../lib/probe.js';

const target: ProbeTarget = { source: 'test', url: 'https://example.test/', marker: /data-row/g };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('probeOne', () => {
  it('считает ответ с маркером данных успешным', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<div data-row></div><div data-row></div>')));
    const result = await probeOne(target);
    expect(result).toMatchObject({ ok: true, status: 200, markerCount: 2, blocked: null, error: null });
  });

  it('распознаёт капчу Cloudflare', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Just a moment...', { status: 403, headers: { 'cf-mitigated': 'challenge' } })),
    );
    const result = await probeOne(target);
    expect(result.ok).toBe(false);
    expect(result.blocked).toBe('cf-mitigated: challenge');
  });

  it('не считает успехом страницу без маркера', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>новая вёрстка</html>')));
    const result = await probeOne(target);
    expect(result).toMatchObject({ ok: false, markerCount: 0 });
  });

  it('записывает сетевую ошибку', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    const result = await probeOne(target);
    expect(result).toMatchObject({ ok: false, status: null, error: 'TypeError: fetch failed' });
  });
});

describe('GET /api/probe', () => {
  it('выключен, пока не задан PROBE_TOKEN', async () => {
    vi.stubEnv('PROBE_TOKEN', '');
    const response = await GET(new Request('http://localhost/api/probe'));
    expect(response.status).toBe(503);
  });

  it('отказывает без правильного токена и не ходит к источникам', async () => {
    vi.stubEnv('PROBE_TOKEN', 'secret');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const response = await GET(new Request('http://localhost/api/probe?token=wrong'));
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
