import { describe, expect, it } from 'vitest';
import { parseNbpTables } from '../lib/nbp.js';

describe('parseNbpTables', () => {
  it('средние курсы таблиц A и B в один справочник, за 1 единицу', () => {
    const a = [{ table: 'A', rates: [{ code: 'USD', mid: 3.9211 }, { code: 'HUF', mid: 0.012019 }] }];
    const b = [{ table: 'B', rates: [{ code: 'GEL', mid: 1.45 }, { code: 'USD', mid: 9 }] }];
    expect(parseNbpTables(a, b)).toEqual({ USD: 3.9211, HUF: 0.012019, GEL: 1.45 });
  });
});
