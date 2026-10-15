// Быстрые подсказки мест (FR-26): населённые пункты и районы городов из GeoNames (CC BY 4.0) в нашей базе.
// Публичный Photon отвечал по 8–10 с (15.10.2026) — города и деревни теперь находятся сразу, Photon — для адресов.

/** «Łódź» → «lodz», «Ёлки» → «елки»: поиск без учёта регистра и диакритики. */
export const normalizePlace = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const SCRIPT = /^[\p{Script=Latin}\p{Script=Cyrillic}\s.\-()’']+$/u;

/** Варианты названия, годные для поиска: латиница и кириллица, без кодов и чужих алфавитов. */
export function placeVariants(name: string, ascii: string, alternates: string): string[] {
  const all = [name, ascii, ...alternates.split(',')].map((v) => v.trim()).filter((v) => v.length >= 2 && v.length <= 60 && SCRIPT.test(v));
  return [...new Set(all)];
}

export const searchKey = (variants: string[]) => `|${[...new Set(variants.map(normalizePlace))].join('|')}|`;

const isCyrillic = (s: string) => /[а-яё]/i.test(s);

/**
 * Что показать: латиницей — официальное название (а не «Lodzes Aleksandruvas» из вариантов);
 * кириллицей — кириллический вариант, который начинается с набранного (русский встречается чаще белорусского).
 */
export function placeLabel(names: string[], official: string, query: string): string {
  if (!isCyrillic(query)) return official;
  const q = normalizePlace(query);
  const cyr = names.filter(isCyrillic);
  return cyr.find((n) => normalizePlace(n).startsWith(q)) ?? cyr[0] ?? official;
}

/** Ранжирование: крупнее и ближе к центру карты — выше (деревня рядом важнее одноимённой за 300 км). */
export function placeScore(population: number, distanceKm: number): number {
  return Math.log10(population + 10) - distanceKm / 60;
}
