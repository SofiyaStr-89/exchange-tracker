import { describe, expect, it } from 'vitest';
import { calculate } from '../app/src/calculator.js';

const rate = { buy: 3.85, sell: 3.92, rateUpdatedAt: null, confirmedAt: '2026-10-13T10:00:00Z', source: 'x' };

describe('calculate (FR-30, FR-31)', () => {
  it('«Покупаю 500 $» — плачу по курсу продажи обменника', () => {
    expect(calculate(500, rate, 'buy', 'foreign')).toEqual({ result: 1960, side: 'sell' });
  });

  it('«Продаю 500 $» — получаю по курсу покупки обменника', () => {
    expect(calculate(500, rate, 'sell', 'foreign')).toEqual({ result: 1925, side: 'buy' });
  });

  it('обратное направление: плачу 1000 zł — сколько получу валюты при «Покупаю»', () => {
    expect(calculate(1000, rate, 'buy', 'local')!.result).toBeCloseTo(255.1, 1);
  });

  it('обратное направление: хочу получить 1000 zł — сколько валюты продать', () => {
    expect(calculate(1000, rate, 'sell', 'local')!.result).toBeCloseTo(259.74, 2);
  });

  it('нужной стороны курса нет или сумма не положительная — null', () => {
    expect(calculate(500, { ...rate, sell: null }, 'buy', 'foreign')).toBeNull();
    expect(calculate(0, rate, 'buy', 'foreign')).toBeNull();
    expect(calculate(Number.NaN, rate, 'buy', 'foreign')).toBeNull();
  });
});
