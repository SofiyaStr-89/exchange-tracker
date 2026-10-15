import { describe, expect, it } from 'vitest';
import { matchesCurrency } from '../app/src/currency-picker.js';
import { currencyName, currencyShort } from '../app/src/currencies.js';
import { goldCode, parseGoldCode } from '../lib/gold.js';

describe('выбор валюты: поиск', () => {
  it('по коду и названию, без учёта регистра', () => {
    expect(matchesCurrency('PLN', 'pln', 'польский злотый')).toBe(true);
    expect(matchesCurrency('PLN', 'злот', 'польский злотый')).toBe(true);
    expect(matchesCurrency('USD', 'злот', 'доллар США')).toBe(false);
  });

  it('золото находится по «зол», «gold», «złoto»', () => {
    for (const q of ['зол', 'Gold', 'złoto', 'zloto']) expect(matchesCurrency('XAU999', q)).toBe(true);
    expect(matchesCurrency('USD', 'зол', 'доллар США')).toBe(false);
  });
});

describe('коды золота', () => {
  it('проба за 1 г и слиток по весу', () => {
    expect(goldCode('purity', '999')).toBe('XAU999');
    expect(goldCode('bar', '10')).toBe('XAU10G');
    expect(parseGoldCode('XAU10G')).toEqual({ kind: 'bar', item: '10' });
    expect(parseGoldCode('USD')).toBeNull();
    expect(currencyName('XAU999')).toBe('Золото, проба 999 (за 1 г)');
    expect(currencyShort('XAU10G')).toBe('слиток 10 г');
  });
});
