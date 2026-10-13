// Русские названия улиц в Беларуси (FR-25): в OSM улицы подписаны по-белорусски, и поиск Photon русских
// не понимает («независимости 170» — пусто, «незалежнасці 170» — находит). Словарь слов «русское → белорусское»
// собран из пар name:ru / name OSM (`npm run build-by-words`); запрос переводим по словам, подсказки — обратно.

export type Dictionary = Record<string, string>;

const WORD = /[\p{L}\d-]+/gu;
const key = (word: string) => word.toLowerCase().replace(/ё/g, 'е');
export const hasCyrillic = (text: string) => /[а-яё]/i.test(text);

function commonPrefix(words: string[]): string {
  let prefix = words[0] ?? '';
  for (const w of words) while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}

/**
 * «независимости 170» → «незалежнасці 170». Последнее слово может быть недописано («независ») —
 * тогда берём общее начало переводов всех слов с таким началом (поиск Photon сам допишет).
 */
export function toBelarusian(query: string, dict: Dictionary, keys: string[] = Object.keys(dict)): string {
  const matches = [...query.matchAll(WORD)];
  let out = '';
  let pos = 0;
  matches.forEach((m, i) => {
    const word = m[0];
    const k = key(word);
    let be = dict[k];
    if (!be && i === matches.length - 1 && k.length >= 3 && !/\d/.test(k)) {
      const prefix = commonPrefix(keys.filter((x) => x.startsWith(k)).map((x) => dict[x]!));
      if (prefix.length >= 3) be = prefix;
    }
    out += query.slice(pos, m.index) + (be ?? word);
    pos = m.index! + word.length;
  });
  return out + query.slice(pos);
}

/** Обратный словарь; при нескольких русских вариантах одного белорусского слова — первый. */
export function reverse(dict: Dictionary): Dictionary {
  const out: Dictionary = {};
  for (const [ru, be] of Object.entries(dict)) out[be] ??= ru;
  return out;
}

/** «праспект Незалежнасці» → «проспект Независимости» (с сохранением заглавной буквы). */
export function toRussian(text: string, back: Dictionary): string {
  return text.replace(WORD, (word) => {
    const ru = back[word.toLowerCase()];
    if (!ru) return word;
    return word[0] === word[0]!.toUpperCase() ? ru[0]!.toUpperCase() + ru.slice(1) : ru;
  });
}
