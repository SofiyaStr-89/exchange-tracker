import { describe, expect, it } from 'vitest';
import { parseOpeningHours } from '../lib/opening-hours.js';

const d = (a: string, b: string): [string, string] => [a, b];

describe('parseOpeningHours (OSM opening_hours → часы по дням)', () => {
  it('диапазон дней и выходной', () => {
    expect(parseOpeningHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off')).toEqual({
      mon: d('09:00', '18:00'),
      tue: d('09:00', '18:00'),
      wed: d('09:00', '18:00'),
      thu: d('09:00', '18:00'),
      fri: d('09:00', '18:00'),
      sat: d('10:00', '14:00'),
      sun: null,
    });
  });

  it('перечисление дней и перерыв на обед — от первого открытия до последнего закрытия', () => {
    expect(parseOpeningHours('Mo,We 09:00-13:00,14:00-17:00')).toEqual({ mon: d('09:00', '17:00'), wed: d('09:00', '17:00') });
  });

  it('круглосуточно', () => {
    const all = parseOpeningHours('24/7');
    expect(Object.keys(all!)).toHaveLength(7);
    expect(all!.sun).toEqual(['00:00', '24:00']);
  });

  it('диапазон через воскресенье и «24:00»', () => {
    expect(parseOpeningHours('Sa-Mo 10:00-24:00')).toEqual({ sat: d('10:00', '24:00'), sun: d('10:00', '24:00'), mon: d('10:00', '24:00') });
  });

  it('праздники игнорируются, непонятное — null (часы неизвестны, FR-22)', () => {
    expect(parseOpeningHours('Mo-Fr 09:00-17:00; PH off')).toMatchObject({ mon: d('09:00', '17:00') });
    expect(parseOpeningHours('sunrise-sunset')).toBeNull();
    expect(parseOpeningHours('')).toBeNull();
    expect(parseOpeningHours(undefined)).toBeNull();
  });
});
