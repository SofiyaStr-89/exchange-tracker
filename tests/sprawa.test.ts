import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseShortHours, parseSprawa } from '../lib/adapters/sprawa.js';

const html = readFileSync(new URL('./fixtures/sprawa-sample.html', import.meta.url), 'utf8');
const result = parseSprawa(html, 'warszawa');

describe('parseSprawa (вёрстка с 13.10.2026)', () => {
  it('только точки своего города — с адресом, телефоном, часами и сайтом', () => {
    expect(result.exchangers).toEqual([
      expect.objectContaining({
        id: 'pl-warszawa-sprawa-pulawska-2',
        name: 'Kantor Sprawa',
        address: 'ul. Puławska 2 (poziom -1), Warszawa',
        city: 'Warszawa',
        lat: null,
        phone: '+48 668 301 888',
        website: 'https://kantorsprawa.pl/warszawa',
        hours: expect.objectContaining({ mon: ['09:00', '21:00'], sat: ['09:00', '21:00'], sun: null }),
      }),
      expect.objectContaining({
        id: 'pl-warszawa-sprawa-al-jana-pawla-ii-29',
        address: 'al. Jana Pawła II 29, Warszawa',
        hours: expect.objectContaining({ sun: ['09:00', '21:00'] }),
      }),
    ]);
  });

  it('курсы в kantorze (не онлайн) на обе точки; время по Варшаве', () => {
    const usd = result.rates.filter((r) => r.currency === 'USD');
    expect(usd.map((r) => r.exchangerId)).toEqual(['pl-warszawa-sprawa-pulawska-2', 'pl-warszawa-sprawa-al-jana-pawla-ii-29']);
    expect(usd[0]).toMatchObject({ buy: 3.88, sell: 3.91, rateUpdatedAt: new Date('2026-10-13T14:38:19Z'), source: 'sprawa' });
  });

  it('новые купюры USD (NEW) пропускаются', () => {
    expect([...new Set(result.rates.map((r) => r.currency))]).toEqual(['USD', 'EUR', 'GBP', 'CHF']);
  });

  it('часы «Pon–Sob» и «Pon-Nd»', () => {
    expect(parseShortHours('Pon–Sob', '9:00', '21:00')).toMatchObject({ fri: ['09:00', '21:00'], sat: ['09:00', '21:00'], sun: null });
    expect(parseShortHours('Pon-Nd', '8:00', '20:00')).toMatchObject({ sun: ['08:00', '20:00'] });
    expect(parseShortHours('Wtorek', '8:00', '20:00')).toBeNull();
  });
});
