import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKursarzPage } from '../lib/adapters/kursarz.js';

const html = readFileSync('tests/fixtures/kursarz-sample.html', 'utf8');
const { exchangers, rates } = parseKursarzPage(html, 'USD', 'Warszawa', 'pl-warszawa');
const byName = (part: string) => exchangers.find((e) => e.name.includes(part))!;
const rateOf = (id: string) => rates.find((r) => r.exchangerId === id)!;

describe('kursarz.pl', () => {
  it('kantory города с адресом и индексом; другой город по подстроке отброшен', () => {
    expect(exchangers).toHaveLength(4);
    expect(byName('Sprawa')).toMatchObject({
      id: 'pl-warszawa-kursarz-1459',
      city: 'Warszawa',
      address: 'Jana Pawła II 29, 00-566 Warszawa',
      lat: null,
      sourceIds: { kursarz: '1459' },
    });
    expect(byName('Zawisza').address).toBe('Al. Jerozolimskie 60 B - Plac Zawiszy, Warszawa');
  });

  it('курс и время (Варшава); 0 — нет стороны курса', () => {
    expect(rateOf('pl-warszawa-kursarz-1459')).toMatchObject({ buy: 3.885, sell: 3.915, source: 'kursarz' });
    expect(rateOf('pl-warszawa-kursarz-1459').rateUpdatedAt?.toISOString()).toBe('2026-10-12T10:00:00.000Z');
    expect(rateOf(byName('Zawisza').id)).toMatchObject({ buy: null, sell: 3.9 });
  });

  it('курс за 100 единиц пересчитывается на одну', () => {
    expect(rateOf(byName('Conti').id)).toMatchObject({ buy: 3.9, sell: 3.92 });
  });

  it('другая валюта на странице не берётся', () => {
    expect(parseKursarzPage(html, 'EUR', 'Warszawa', 'pl-warszawa').rates).toHaveLength(0);
  });
});
