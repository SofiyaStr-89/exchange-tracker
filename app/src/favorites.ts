// Избранное (FR-33–FR-35): id обменников в localStorage, без регистрации.
// Обменник склеен из нескольких записей, основной id может смениться — совпадение по любому id группы.

export type FavoriteTarget = { id: string; memberIds?: string[] };

const idsOf = (e: FavoriteTarget) => (e.memberIds?.length ? e.memberIds : [e.id]);

export function isFavorite(favorites: readonly string[], e: FavoriteTarget): boolean {
  return idsOf(e).some((id) => favorites.includes(id));
}

/** Добавить или убрать; при удалении убираются все id группы, чтобы звёздочка не вернулась. */
export function toggleFavorite(favorites: readonly string[], e: FavoriteTarget): string[] {
  if (!isFavorite(favorites, e)) return [...favorites, e.id];
  const group = new Set(idsOf(e));
  return favorites.filter((id) => !group.has(id));
}

/** Из сохранённого — только строки (localStorage мог быть испорчен). */
export function cleanFavorites(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}
