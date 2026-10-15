import { describe, expect, it } from 'vitest';
import { normalizePlace, placeLabel, placeScore, placeVariants, searchKey } from '../lib/places.js';

describe('справочник мест', () => {
  const kolodishchi = placeVariants('Kalodzishchy', 'Kalodzishchy', 'Kalodzishchy,Kolodishchi,Kolodishhi,Калодзішчы,Колодищи,科洛季希');

  it('варианты: латиница и кириллица, без чужих алфавитов; ключ поиска', () => {
    expect(kolodishchi).toEqual(['Kalodzishchy', 'Kolodishchi', 'Kolodishhi', 'Калодзішчы', 'Колодищи']);
    expect(searchKey(kolodishchi)).toContain('|колодищи|');
    expect(normalizePlace('Łódź')).toBe('lodz');
  });

  it('подпись: кириллицей — набранный вариант, латиницей — официальное название', () => {
    expect(placeLabel(kolodishchi, 'Kalodzishchy', 'колод')).toBe('Колодищи');
    expect(placeLabel(kolodishchi, 'Kalodzishchy', 'калодз')).toBe('Калодзішчы');
    expect(placeLabel(['Aleksandrów Łódzki', 'Lodzes Aleksandruvas'], 'Aleksandrów Łódzki', 'lodz')).toBe('Aleksandrów Łódzki');
  });

  it('крупнее и ближе — выше', () => {
    expect(placeScore(17000, 15)).toBeGreaterThan(placeScore(0, 15));
    expect(placeScore(0, 5)).toBeGreaterThan(placeScore(0, 300));
  });
});
