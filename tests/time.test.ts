import { describe, expect, it } from 'vitest';
import { zonedWallTimeToUtc } from '../lib/time.js';

describe('zonedWallTimeToUtc', () => {
  it('летнее время Варшавы (UTC+2)', () => {
    expect(zonedWallTimeToUtc('2026-10-08T16:00:18', 'Europe/Warsaw').toISOString()).toBe('2026-10-08T14:00:18.000Z');
  });

  it('зимнее время Варшавы (UTC+1)', () => {
    expect(zonedWallTimeToUtc('2026-01-15T10:05:00', 'Europe/Warsaw').toISOString()).toBe('2026-01-15T09:05:00.000Z');
  });

  it('Минск всегда UTC+3', () => {
    expect(zonedWallTimeToUtc('2026-10-07 17:20:00', 'Europe/Minsk').toISOString()).toBe('2026-10-07T14:20:00.000Z');
  });

  it('отвергает непонятную строку', () => {
    expect(() => zonedWallTimeToUtc('вчера', 'Europe/Warsaw')).toThrow();
  });
});
