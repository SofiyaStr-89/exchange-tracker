import { describe, expect, it } from 'vitest';
import { cleanFavorites, isFavorite, toggleFavorite } from '../app/src/favorites.js';

describe('избранное', () => {
  it('добавляет и убирает', () => {
    const added = toggleFavorite([], { id: 'a', memberIds: ['a'] });
    expect(added).toEqual(['a']);
    expect(toggleFavorite(added, { id: 'a', memberIds: ['a'] })).toEqual([]);
  });

  it('узнаёт обменник, если основной id группы склейки сменился', () => {
    const e = { id: 'kl-1', memberIds: ['kl-1', 'osm-1'] };
    expect(isFavorite(['osm-1'], e)).toBe(true);
    expect(isFavorite(['x'], e)).toBe(false);
    expect(toggleFavorite(['x', 'osm-1'], e)).toEqual(['x']);
  });

  it('испорченное хранилище — пустой список', () => {
    expect(cleanFavorites('oops')).toEqual([]);
    expect(cleanFavorites(['a', 1, null])).toEqual(['a']);
  });
});
