import { describe, expect, it } from 'vitest';
import { bestIds, rateAgeMs, rateFor, type ApiRate } from '../app/src/rates.js';

const now = new Date('2026-10-08T16:00:00Z');
const usd = (sell: number, buy: number, updated = '2026-10-08T15:50:00Z', source = 'kantorlive') => ({
  USD: { buy, sell, rateUpdatedAt: updated, confirmedAt: '2026-10-08T15:55:00Z', source },
});
const ex = (id: string, rates: Record<string, ApiRate>, open = true) => ({ id, open, rates });

describe('rateFor (FR-12)', () => {
  it('«Покупаю» — курс продажи обменника, «Продаю» — курс покупки', () => {
    const e = ex('a', usd(3.95, 3.85));
    expect(rateFor(e, 'USD', 'buy')).toBe(3.95);
    expect(rateFor(e, 'USD', 'sell')).toBe(3.85);
  });

  it('нет валюты или нужной стороны — null (FR-15)', () => {
    expect(rateFor(ex('a', usd(3.95, 3.85)), 'EUR', 'buy')).toBeNull();
    expect(rateFor(ex('a', { USD: { buy: 3.85, sell: null, rateUpdatedAt: null, confirmedAt: '2026-10-08T15:55:00Z', source: 'x' } }), 'USD', 'buy')).toBeNull();
  });
});

describe('rateAgeMs (FR-24, правило 6)', () => {
  it('обычный источник — от времени курса', () => {
    expect(rateAgeMs(usd(1, 1).USD, now)).toBe(10 * 60_000);
  });
  it('официальный API банка — от последнего подтверждения', () => {
    expect(rateAgeMs(usd(1, 1, '2026-10-05T10:00:00Z', 'belarusbank').USD, now)).toBe(5 * 60_000);
  });
});

describe('bestIds (FR-16)', () => {
  it('«Покупаю» — минимальный курс, при равенстве все', () => {
    const list = [ex('a', usd(3.95, 3.85)), ex('b', usd(3.91, 3.8)), ex('c', usd(3.91, 3.84))];
    expect(bestIds(list, 'USD', 'buy', now)).toEqual(new Set(['b', 'c']));
  });

  it('«Продаю» — максимальный', () => {
    const list = [ex('a', usd(3.95, 3.85)), ex('b', usd(3.91, 3.8))];
    expect(bestIds(list, 'USD', 'sell', now)).toEqual(new Set(['a']));
  });

  it('закрытые и с курсом старше 24 часов не участвуют', () => {
    const list = [
      ex('closed', usd(3.5, 3.9), false),
      ex('old', usd(3.6, 3.9, '2026-10-07T15:00:00Z')),
      ex('ok', usd(3.95, 3.85)),
    ];
    expect(bestIds(list, 'USD', 'buy', now)).toEqual(new Set(['ok']));
  });

  it('никого нет — пусто', () => {
    expect(bestIds([], 'USD', 'buy', now)).toEqual(new Set());
  });
});
