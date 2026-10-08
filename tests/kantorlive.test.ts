import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKantorLive } from '../lib/adapters/kantorlive.js';

const sample = JSON.parse(readFileSync(new URL('./fixtures/kantorlive-sample.json', import.meta.url), 'utf8'));
const result = parseKantorLive(sample, 'warszawa');
const byId = Object.fromEntries(result.exchangers.map((e) => [e.id, e]));

describe('parseKantorLive: обменники', () => {
  it('берёт все kantory города со стабильным id из номера в slug', () => {
    expect(result.exchangers.map((e) => e.id)).toEqual([
      'pl-warszawa-kantorlive-111111',
      'pl-warszawa-kantorlive-222222',
      'pl-warszawa-kantorlive-333333',
    ]);
    expect(byId['pl-warszawa-kantorlive-111111']).toMatchObject({
      country: 'PL',
      city: 'Warszawa',
      name: 'Kantor Testowy Centrum',
      address: 'Marszałkowska 1, 00-001 Warszawa',
      bank: null,
      sourceIds: { kantorlive: '111111' },
    });
  });

  it('координаты из источника; без координат — null', () => {
    expect(byId['pl-warszawa-kantorlive-111111']).toMatchObject({ lat: 52.23, lng: 21.01, coordsSource: 'source' });
    expect(byId['pl-warszawa-kantorlive-222222']).toMatchObject({ lat: null, lng: null, coordsSource: null });
  });

  it('часы по дням; 00:01–00:02 — выходной; 00:00–23:59 — круглосуточно', () => {
    expect(byId['pl-warszawa-kantorlive-111111']!.hours).toEqual({
      mon: ['09:00', '18:00'],
      tue: ['09:00', '18:00'],
      wed: ['09:00', '18:00'],
      thu: ['09:00', '18:00'],
      fri: ['09:00', '18:00'],
      sat: ['09:30', '13:30'],
      sun: null,
    });
    expect(byId['pl-warszawa-kantorlive-222222']!.hours).toEqual({ mon: ['00:00', '24:00'], sun: ['00:00', '24:00'] });
  });

  it('пустое расписание — часы неизвестны (FR-22)', () => {
    expect(byId['pl-warszawa-kantorlive-333333']!.hours).toBeNull();
  });
});

describe('parseKantorLive: курсы', () => {
  const rate = (id: string, currency: string) =>
    result.rates.find((r) => r.exchangerId === `pl-warszawa-kantorlive-${id}` && r.currency === currency);

  it('курс с временем: помечено +00:00, но это время Варшавы (правило склейки 6)', () => {
    expect(rate('111111', 'USD')).toEqual({
      exchangerId: 'pl-warszawa-kantorlive-111111',
      currency: 'USD',
      buy: 3.865,
      sell: 3.91,
      rateUpdatedAt: new Date('2026-10-08T14:00:18Z'),
      source: 'kantorlive',
    });
    expect(rate('333333', 'EUR')!.rateUpdatedAt).toEqual(new Date('2026-01-15T09:05:00Z'));
  });

  it('ноль на одной стороне — этой стороны нет (правило 4)', () => {
    expect(rate('111111', 'BGN')).toMatchObject({ buy: 1.5, sell: null });
  });

  it('обе стороны нулевые — валюты нет', () => {
    expect(rate('111111', 'XAU')).toBeUndefined();
  });

  it('курс за 100 единиц делится (правило 5)', () => {
    expect(rate('111111', 'HUF')).toMatchObject({ buy: 0.01183, sell: 0.01219 });
  });

  it('kantor без свежих курсов попадает в список без курсов (FR-15)', () => {
    expect(result.rates.filter((r) => r.exchangerId.endsWith('222222'))).toEqual([]);
  });
});
