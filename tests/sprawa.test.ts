import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSprawa } from '../lib/adapters/sprawa.js';

const html = readFileSync(new URL('./fixtures/sprawa-sample.html', import.meta.url), 'utf8');
const result = parseSprawa(html, 'warszawa');

describe('parseSprawa', () => {
  it('обе точки города с адресом, телефоном, часами и сайтом', () => {
    expect(result.exchangers).toEqual([
      expect.objectContaining({
        id: 'pl-warszawa-sprawa-pulawska-2',
        name: 'Kantor Sprawa',
        address: 'Puławska 2, 02-566 Warszawa',
        city: 'Warszawa',
        lat: null,
        phone: '+48 668 301 888',
        website: 'https://kantorsprawa.pl/warszawa',
        hours: { mon: ['09:00', '21:00'], tue: ['09:00', '21:00'], wed: ['09:00', '21:00'], thu: ['09:00', '21:00'], fri: ['09:00', '21:00'], sat: ['09:00', '21:00'], sun: null },
      }),
      expect.objectContaining({
        id: 'pl-warszawa-sprawa-al-jana-pawla-ii-29',
        address: 'al. Jana Pawła II 29, 00-867 Warszawa',
        hours: expect.objectContaining({ sun: ['09:00', '21:00'] }),
      }),
    ]);
  });

  it('одни курсы на обе точки; время «Aktualizacja» по Варшаве', () => {
    const usd = result.rates.filter((r) => r.currency === 'USD');
    expect(usd.map((r) => r.exchangerId)).toEqual(['pl-warszawa-sprawa-pulawska-2', 'pl-warszawa-sprawa-al-jana-pawla-ii-29']);
    expect(usd[0]).toMatchObject({ buy: 3.875, sell: 3.91, rateUpdatedAt: new Date('2026-10-08T16:30:31Z'), source: 'sprawa' });
  });

  it('новые купюры USD и монеты пропускаются', () => {
    expect(result.rates.map((r) => r.currency).filter((c, i, a) => a.indexOf(c) === i)).toEqual(['USD', 'HUF']);
  });
});
