import { describe, expect, it } from 'vitest';
import { hasCyrillic, reverse, toBelarusian, toRussian } from '../lib/by-words.js';

const dict = { проспект: 'праспект', независимости: 'незалежнасці', улица: 'вуліца', ленина: 'леніна', минск: 'мінск', победителей: 'пераможцаў' };

describe('словарь улиц Беларуси', () => {
  it('переводит запрос по словам, номер дома и знаки не трогает', () => {
    expect(toBelarusian('независимости 170', dict)).toBe('незалежнасці 170');
    expect(toBelarusian('Минск, проспект Независимости 170', dict)).toBe('мінск, праспект незалежнасці 170');
    expect(toBelarusian('Galeria Mokotów', dict)).toBe('Galeria Mokotów');
  });

  it('недописанное последнее слово — общее начало переводов', () => {
    expect(toBelarusian('независ', dict)).toBe('незалежнасці');
    expect(toBelarusian('пр', dict)).toBe('пр'); // слишком коротко
  });

  it('ё и е — одно и то же', () => {
    expect(toBelarusian('улица Лёнина', dict)).toBe('вуліца леніна');
    expect(toBelarusian('Ленина', dict)).toBe('леніна');
  });

  it('подсказку показывает по-русски', () => {
    const back = reverse(dict);
    expect(toRussian('праспект Незалежнасці', back)).toBe('проспект Независимости');
    expect(toRussian('Мінск', back)).toBe('Минск');
    expect(toRussian('SoftClub', back)).toBe('SoftClub');
  });

  it('кириллица в запросе', () => {
    expect(hasCyrillic('независимости 170')).toBe(true);
    expect(hasCyrillic('Złota 59')).toBe(false);
  });
});
