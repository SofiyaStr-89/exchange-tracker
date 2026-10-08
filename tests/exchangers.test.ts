import { describe, expect, it } from 'vitest';
import { citiesNear } from '../lib/cities.js';
import { boundsSize, isStale, mergeRates, splitByBounds, type RateRow } from '../lib/exchangers.js';

const center = { lat: 52.2297, lng: 21.0122 };
const at = (dLatMeters: number, id: string) => ({ id, lat: center.lat + dLatMeters / 111_195, lng: center.lng });

describe('splitByBounds', () => {
  // Область ~1,1 км по высоте вокруг center.
  const bounds = { south: center.lat - 0.005, north: center.lat + 0.005, west: center.lng - 0.008, east: center.lng + 0.008 };
  const points = [at(1500, 'c'), at(100, 'a'), at(450, 'b'), at(2500, 'd'), at(5000, 'e'), at(9000, 'f'), at(30_000, 'far')];

  it('в области — по возрастанию расстояния от центра, с расстоянием в метрах', () => {
    const { inView } = splitByBounds(points, bounds);
    expect(inView.map((p) => p.id)).toEqual(['a', 'b']);
    expect(inView[0]!.distance).toBe(100);
  });

  it('за областью — 3 ближайших не дальше 20 км (FR-9)', () => {
    expect(splitByBounds(points, bounds).nearest.map((p) => p.id)).toEqual(['c', 'd', 'e']);
    const north = { south: center.lat + 0.2, north: center.lat + 0.201, west: center.lng, east: center.lng + 0.001 };
    expect(splitByBounds(points, north).nearest.map((p) => p.id)).toEqual(['far', 'f', 'e']);
  });

  it('ближайшие — только подходящие под фильтр (с курсом нужной валюты)', () => {
    expect(splitByBounds(points, bounds, (p) => p.id !== 'c').nearest.map((p) => p.id)).toEqual(['d', 'e', 'f']);
  });
});

describe('boundsSize', () => {
  it('ширина и высота области в метрах', () => {
    const { width, height } = boundsSize({ south: 52.2, north: 52.3, west: 21.0, east: 21.1 });
    expect(Math.round(height / 100)).toBe(111);
    expect(Math.round(width / 100)).toBe(68);
  });
});

describe('mergeRates (правило склейки 2)', () => {
  const row = (r: Partial<RateRow>): RateRow => ({
    currency: 'USD',
    buy: 3.8,
    sell: 3.9,
    rateUpdatedAt: null,
    confirmedAt: new Date('2026-10-08T14:00:00Z'),
    source: 'kantorlive',
    ...r,
  });

  it('по каждой валюте берёт самый свежий курс', () => {
    const merged = mergeRates([
      row({ source: 'kantorlive', sell: 3.9, rateUpdatedAt: new Date('2026-10-08T13:00:00Z') }),
      row({ source: 'zlata', sell: 3.95, rateUpdatedAt: new Date('2026-10-08T14:30:00Z') }),
      row({ currency: 'EUR', source: 'kantorlive', sell: 4.4 }),
    ]);
    expect(merged.USD).toMatchObject({ source: 'zlata', sell: 3.95 });
    expect(merged.EUR).toMatchObject({ source: 'kantorlive', sell: 4.4 });
  });

  it('при равной свежести приоритет у официального API банка', () => {
    const t = new Date('2026-10-08T14:00:00Z');
    const merged = mergeRates([
      row({ source: 'myfin', sell: 3.1, rateUpdatedAt: t }),
      row({ source: 'belarusbank', sell: 3.08, rateUpdatedAt: t }),
    ]);
    expect(merged.USD).toMatchObject({ source: 'belarusbank' });
  });
});

describe('isStale', () => {
  const now = new Date('2026-10-08T15:00:00Z');
  it('данных нет или старше 15 минут — обновлять', () => {
    expect(isStale(null, now)).toBe(true);
    expect(isStale(new Date('2026-10-08T14:44:59Z'), now)).toBe(true);
  });
  it('свежее 15 минут — не трогать источник', () => {
    expect(isStale(new Date('2026-10-08T14:46:00Z'), now)).toBe(false);
  });
});

describe('citiesNear', () => {
  it('точка в Варшаве — Варшава', () => {
    expect(citiesNear(center).map((c) => c.id)).toEqual(['pl-warszawa']);
  });
  it('точка в Кракове — пока ни одного города', () => {
    expect(citiesNear({ lat: 50.0614, lng: 19.9366 })).toEqual([]);
  });
});
