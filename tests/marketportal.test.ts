import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMarketportalPage } from '../lib/adapters/marketportal.js';

const html = readFileSync(new URL('./fixtures/marketportal-sample.html', import.meta.url), 'utf8');
const page = parseMarketportalPage(html, 'EUR', 'warszawa');
const byId = Object.fromEntries(page.exchangers.map((e) => [e.id, e]));
const rate = (eoid: string) => page.rates.find((r) => r.exchangerId === `pl-warszawa-marketportal-${eoid}`);

describe('parseMarketportalPage: обменники', () => {
  it('каждый kantor один раз, по стабильному номеру', () => {
    expect(page.exchangers.map((e) => e.id).sort()).toEqual([
      'pl-warszawa-marketportal-39',
      'pl-warszawa-marketportal-421',
      'pl-warszawa-marketportal-77',
    ]);
  });

  it('координаты с десятичной запятой, адрес, телефон, сайт', () => {
    expect(byId['pl-warszawa-marketportal-421']).toMatchObject({
      country: 'PL',
      city: 'Warszawa',
      name: 'Kantor Testowy',
      address: 'Złota 1, Warszawa',
      lat: 52.244059,
      lng: 20.99113,
      coordsSource: 'source',
      phone: '797 004 196',
      website: 'https://testowy.example/',
      sourceIds: { marketportal: '421' },
    });
    expect(byId['pl-warszawa-marketportal-77']!.name).toBe('Kantor & Bez Kursu');
  });

  it('часы по дням: «Zamknięte» — выходной, «9:30» → «09:30»', () => {
    expect(byId['pl-warszawa-marketportal-421']!.hours).toMatchObject({ mon: ['10:00', '17:00'], sat: null, sun: null });
    expect(byId['pl-warszawa-marketportal-39']!.hours).toEqual({ mon: ['09:30', '18:00'], sun: null });
    expect(byId['pl-warszawa-marketportal-77']!.hours).toBeNull();
  });

  it('сайт только http(s)', () => {
    expect(byId['pl-warszawa-marketportal-39']!.website).toBeNull();
  });
});

describe('parseMarketportalPage: курсы', () => {
  it('розничный курс главнее оптового; время по Варшаве', () => {
    expect(rate('421')).toEqual({
      exchangerId: 'pl-warszawa-marketportal-421',
      currency: 'EUR',
      buy: 4.31,
      sell: 4.44,
      rateUpdatedAt: new Date('2026-10-08T16:34:00Z'),
      source: 'marketportal',
    });
  });

  it('только оптовый — берётся оптовый', () => {
    expect(rate('39')).toMatchObject({ buy: 4.37, sell: 4.39 });
  });

  it('без курса — обменник есть, курса нет', () => {
    expect(rate('77')).toBeUndefined();
  });
});
