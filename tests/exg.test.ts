import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExgBranch } from '../lib/adapters/exg.js';

const html = readFileSync(new URL('./fixtures/exg-sample.html', import.meta.url), 'utf8');
const page = parseExgBranch(html, 'warszawa', 'atrium-targowek');
const rate = (c: string) => page.rates.find((r) => r.currency === c);

describe('parseExgBranch', () => {
  it('филиал: название, адрес с индексом, телефон, сайт; координат нет — их найдёт геокодер', () => {
    expect(page.exchanger).toMatchObject({
      id: 'pl-warszawa-exg-atrium-targowek',
      country: 'PL',
      city: 'Warszawa',
      name: 'EXG G-City Targówek',
      address: 'Głębocka 15, 03-287 Warszawa',
      lat: null,
      lng: null,
      coordsSource: null,
      phone: '+48 22 313 12 07',
      website: 'https://www.exg.pl/kantory/kantor/warszawa/atrium-targowek',
      sourceIds: { exg: 'atrium-targowek' },
    });
  });

  it('часы: pn-pt, sob; «nd … (handlowe)» — только торговые воскресенья, считаем выходным', () => {
    expect(page.exchanger.hours).toEqual({
      mon: ['09:00', '21:00'],
      tue: ['09:00', '21:00'],
      wed: ['09:00', '21:00'],
      thu: ['09:00', '21:00'],
      fri: ['09:00', '21:00'],
      sat: ['09:00', '21:00'],
      sun: null,
    });
  });

  it('розничный курс главнее оптового; время «Dane kursów z» по Варшаве', () => {
    expect(rate('USD')).toEqual({
      exchangerId: 'pl-warszawa-exg-atrium-targowek',
      currency: 'USD',
      buy: 3.87,
      sell: 3.97,
      rateUpdatedAt: new Date('2026-10-12T14:26:00Z'),
      source: 'exg',
    });
  });

  it('только оптовый — берётся оптовый, «0,0000» — стороны нет', () => {
    expect(rate('SEK')).toMatchObject({ buy: 0.35, sell: null });
  });

  it('мелкие валюты — за 1 единицу, как есть', () => {
    expect(rate('HUF')).toMatchObject({ buy: 0.0116, sell: 0.0128 });
  });

  it('варианты (старые доллары, монеты) пропускаются; нули — валюты нет', () => {
    expect(page.rates.filter((r) => r.currency === 'USD')).toHaveLength(1);
    expect(rate('EUR')).toBeUndefined();
    expect(rate('DKK')).toBeUndefined();
  });

  it('ссылки на другие филиалы этого города', () => {
    expect(page.otherBranches).toEqual(['galeria-rembielinska', 'sadyba-best-mall']);
  });
});
