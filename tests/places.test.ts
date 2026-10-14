import { describe, expect, it } from 'vitest';
import { groupByPlace } from '../app/src/places.js';

describe('обменники в одном месте', () => {
  it('одинаковые и близкие точки — одно место, дальние — отдельно', () => {
    const korona = { lat: 52.0972, lng: 23.74467 };
    const groups = groupByPlace([
      { id: 'rrb', ...korona },
      { id: 'mtb', ...korona },
      { id: 'bb', lat: 52.0971, lng: 23.7448 }, // 15 м
      { id: 'vtb', lat: 52.1061, lng: 23.7969 },
    ]);
    expect(groups.map((g) => g.map((e) => e.id))).toEqual([['rrb', 'mtb', 'bb'], ['vtb']]);
  });
});

import { sortPlace, type PlaceItem } from '../app/src/place-card.js';

describe('порядок пунктов в месте', () => {
  const item = (id: string, value: number | null, open: boolean) => ({ e: { id } as PlaceItem['e'], value, open, stale: null, next: null, best: false });
  it('открытые раньше, затем лучший курс, без курса — в конце', () => {
    const items = [item('closed-best', 2.9, false), item('no-rate', null, true), item('b', 3.01, true), item('a', 3.005, true)];
    expect(sortPlace(items, 'buy').map((i) => i.e.id)).toEqual(['a', 'b', 'no-rate', 'closed-best']);
    expect(sortPlace(items, 'sell').map((i) => i.e.id)).toEqual(['b', 'a', 'no-rate', 'closed-best']);
  });
});
