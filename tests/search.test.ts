import { describe, expect, it } from 'vitest';
import { citySuggestions, dedupeSuggestions, photonToSuggestion, splitCityQuery } from '../app/src/search-logic.js';

const cities = [
  { id: 'by-minsk', country: 'BY' as const, name: 'Минск', lat: 53.9, lng: 27.56 },
  { id: 'pl-warszawa', country: 'PL' as const, name: 'Warszawa', lat: 52.23, lng: 21.01 },
  { id: 'pl-krakow', country: 'PL' as const, name: 'Kraków', lat: 50.06, lng: 19.94 },
];

describe('citySuggestions', () => {
  it('по началу названия, без учёта регистра и диакритики', () => {
    expect(citySuggestions('мин', cities).map((s) => s.label)).toEqual(['Минск']);
    expect(citySuggestions('krako', cities).map((s) => s.label)).toEqual(['Kraków']);
    expect(citySuggestions('xyz', cities)).toEqual([]);
  });
});

describe('splitCityQuery', () => {
  it('«Минск, вокзал» — город из списка и место', () => {
    expect(splitCityQuery('Минск, вокзал', cities)).toEqual({ city: cities[0], rest: 'вокзал' });
  });
  it('без запятой или неизвестный город — весь запрос как есть', () => {
    expect(splitCityQuery('Złote Tarasy', cities)).toEqual({ city: null, rest: 'Złote Tarasy' });
    expect(splitCityQuery('Гомель, вокзал', cities)).toEqual({ city: null, rest: 'Гомель, вокзал' });
  });
});

describe('photonToSuggestion', () => {
  const f = (props: Record<string, string>, coords: [number, number] = [21.0, 52.23]) => ({
    properties: props,
    geometry: { coordinates: coords },
  });

  it('название, улица с номером и город; координаты [lon, lat]', () => {
    expect(photonToSuggestion(f({ countrycode: 'PL', name: 'Złote Tarasy', street: 'Złota', housenumber: '59', city: 'Warszawa' }))).toEqual({
      label: 'Złote Tarasy',
      detail: 'Złota 59, Warszawa',
      lat: 52.23,
      lng: 21.0,
    });
  });

  it('только Польша и Беларусь (FR-26)', () => {
    expect(photonToSuggestion(f({ countrycode: 'LT', name: 'Vilnius' }))).toBeNull();
  });

  it('адрес без названия — улица и номер как заголовок', () => {
    expect(photonToSuggestion(f({ countrycode: 'BY', street: 'Притыцкого', housenumber: '77', city: 'Мінск' }))).toMatchObject({
      label: 'Притыцкого 77',
      detail: 'Мінск',
    });
  });
});

describe('dedupeSuggestions', () => {
  it('одинаковые название и адрес — один раз', () => {
    const a = { label: 'Вакзал', detail: 'Прывакзальная плошча, Мінск', lat: 1, lng: 1 };
    expect(dedupeSuggestions([a, { ...a, lat: 2 }, { ...a, detail: 'Заслаўе' }])).toHaveLength(2);
  });
});
