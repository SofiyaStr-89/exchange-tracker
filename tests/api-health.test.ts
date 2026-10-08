import { describe, expect, it } from 'vitest';
import { GET } from '../api/health.js';

describe('GET /api/health', () => {
  it('отвечает status ok и списком источников', async () => {
    const response = GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(Array.isArray(body.sources)).toBe(true);
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });
});
