import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMyfinCity } from '../lib/adapters/myfin.js';

const html = readFileSync(new URL('./fixtures/myfin-sample.html', import.meta.url), 'utf8');
const now = new Date('2026-10-12T16:30:00Z'); // 19:30 в Минске
const result = parseMyfinCity(html, 'minsk', now);
const byId = Object.fromEntries(result.exchangers.map((e) => [e.id, e]));

describe('parseMyfinCity', () => {
  it('отделения всех банков, кроме Беларусбанка (его даёт официальный API)', () => {
    expect(result.exchangers.map((e) => e.id)).toEqual(['by-minsk-myfin-alfabank-204', 'by-minsk-myfin-bps-sberbank-12']);
  });

  it('банк по названию с логотипа, адрес в едином виде, координат нет', () => {
    expect(byId['by-minsk-myfin-alfabank-204']).toMatchObject({
      country: 'BY',
      city: 'Минск',
      name: 'Альфа-Банк',
      bank: 'Альфа-Банк',
      address: 'тр. Логойский, 10, Минск',
      lat: null,
      sourceIds: { myfin: 'alfabank-204' },
      website: 'https://myfin.by/bank/alfabank/department/204-minsk-logoyiskiyi-trakt-10',
    });
    expect(byId['by-minsk-myfin-bps-sberbank-12']!.address).toBe('пр-т Победителей, 65, пом. 3, Минск');
  });

  it('курсы за 1 единицу (multiplier), 0 — стороны нет; время сегодня по Минску', () => {
    const rates = result.rates.filter((r) => r.exchangerId === 'by-minsk-myfin-alfabank-204');
    expect(rates.find((r) => r.currency === 'USD')).toEqual({
      exchangerId: 'by-minsk-myfin-alfabank-204',
      currency: 'USD',
      buy: 2.99,
      sell: 3.04,
      rateUpdatedAt: new Date('2026-10-12T15:19:00Z'),
      source: 'myfin',
    });
    expect(rates.find((r) => r.currency === 'RUB')).toMatchObject({ buy: 0.034165, sell: 0.0361 });
    expect(rates.find((r) => r.currency === 'EUR')).toMatchObject({ buy: null, sell: 3.38 });
  });

  it('время позже текущего — значит, вчера (правило склейки 6)', () => {
    const sber = result.rates.find((r) => r.exchangerId === 'by-minsk-myfin-bps-sberbank-12')!;
    expect(sber.rateUpdatedAt).toEqual(new Date('2026-10-11T20:50:00Z'));
  });
});
