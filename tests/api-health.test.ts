import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../api/health.js';

afterEach(() => vi.unstubAllEnvs());

describe('GET /api/health', () => {
  it('отвечает status ok и сообщает, что база не настроена', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'ok', database: 'not_configured', sources: [] });
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
