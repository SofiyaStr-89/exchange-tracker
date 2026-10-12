import { describe, expect, it } from 'vitest';
import { staleLabel } from '../app/src/format.js';

const now = new Date('2026-10-12T15:00:00Z'); // понедельник 17:00 в Варшаве
const rate = (rateUpdatedAt: string | null, source = 'kantorlive', confirmedAt = '2026-10-12T14:55:00Z') => ({
  buy: 3.9,
  sell: 3.95,
  rateUpdatedAt,
  confirmedAt,
  source,
});

describe('staleLabel (FR-23, FR-24)', () => {
  it('не старше 24 часов — без пометки', () => {
    expect(staleLabel(rate('2026-10-11T16:00:00Z'), 'Europe/Warsaw', now)).toBeNull();
  });

  it('старше суток и вчерашней даты — «курс от вчера»', () => {
    expect(staleLabel(rate('2026-10-11T08:00:00Z'), 'Europe/Warsaw', now)).toBe('курс от вчера');
  });

  it('ещё старше — «курс от 12.09»', () => {
    expect(staleLabel(rate('2026-09-12T08:00:00Z'), 'Europe/Warsaw', now)).toBe('курс от 12.09');
  });

  it('дата «вчера» — по времени страны: 23:30 по Варшаве 10.10 — это не вчера', () => {
    expect(staleLabel(rate('2026-10-10T21:30:00Z'), 'Europe/Warsaw', now)).toBe('курс от 10.10');
  });

  it('официальный API банка: время установки старое, но подтверждён сегодня — без пометки (правило 6)', () => {
    expect(staleLabel(rate('2026-10-05T08:00:00Z', 'belarusbank'), 'Europe/Minsk', now)).toBeNull();
  });
});
