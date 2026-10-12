import { describe, expect, it } from 'vitest';
import { countryAt, orderCurrencies } from '../app/src/currencies.js';

describe('countryAt', () => {
  it('Варшава — Польша, Минск и Гродно — Беларусь, Белосток — Польша', () => {
    expect(countryAt({ lat: 52.23, lng: 21.01 })).toBe('PL');
    expect(countryAt({ lat: 53.9, lng: 27.56 })).toBe('BY');
    expect(countryAt({ lat: 53.68, lng: 23.83 })).toBe('BY');
    expect(countryAt({ lat: 53.13, lng: 23.16 })).toBe('PL');
    expect(countryAt({ lat: 52.09, lng: 23.69 })).toBe('BY'); // Брест
    expect(countryAt({ lat: 52.03, lng: 23.12 })).toBe('PL'); // Бяла-Подляска
  });
});

describe('orderCurrencies (FR-10)', () => {
  it('основные валюты страны первыми, остальные — как пришли (по популярности)', () => {
    expect(orderCurrencies('PL', ['GBP', 'CHF', 'EUR', 'USD', 'UAH', 'AUD'])).toEqual(['USD', 'EUR', 'GBP', 'CHF', 'UAH', 'AUD']);
  });
  it('основной валюты нет в данных — её нет и в списке', () => {
    expect(orderCurrencies('BY', ['USD', 'EUR', 'RUB'])).toEqual(['USD', 'EUR', 'RUB']);
  });
});
