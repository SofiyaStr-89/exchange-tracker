// Двойник по названию (правило склейки 3): точка без координат, у которой адрес записан по-другому, чем у того же
// kantoru в другом источнике («Rondo Dmowskiego - Lokal 33» у kursarz и «Przejście podziemne pod Novotelem…,
// Lokal 33» у marketportal). Берём координаты двойника, если общее слово названия сети и общий номер
// (дома, павильона, помещения); если номеров нет хотя бы у одного — общее слово улицы; номера расходятся —
// только при трёх и больше общих словах адреса.

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/ё/g, 'е');

/** Слова, которые есть в названиях почти всех kantorów и пунктов — сеть по ним не отличить. */
const NOT_BRAND = new Set([
  'kantor', 'kantory', 'wymiany', 'walut', 'exchange', 'calodobowy', 'oddzial', 'galeria', 'centrum', 'handlowe',
  'przejscie', 'przej', 'podziemne', 'pawilon', 'lokal', 'lok', 'pod', 'przy', 'dworzec', 'pl', 'com', 'www',
  'отделение', 'обменный', 'пункт', 'цбу', 'банк', 'филиал',
]);
const ADDRESS_NOISE = new Set(['ul', 'al', 'aleje', 'aleja', 'pl', 'plac', 'lok', 'lokal', 'pawilon', 'paw', 'nr', 'obok', 'przy', 'pod', 'stacji', 'wejscie', 'poziom']);

// «K&K» → «kk»; без этого «k» и «k» отбрасываются как слишком короткие.
const words = (s: string) => plain(s.replace(/(\p{L})\s*&\s*(\p{L})/gu, '$1$2')).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export interface TwinCandidate {
  name: string;
  address: string;
  city: string;
}

function brand(name: string, city: string): Set<string> {
  const cityWords = new Set(words(city));
  return new Set(words(name).filter((w) => w.length > 1 && !/^\d+$/.test(w) && !NOT_BRAND.has(w) && !cityWords.has(w)));
}

/** Номера в адресе и названии: дом, павильон, помещение («9a», «140», «34a»); без индекса. */
function numbers(e: TwinCandidate): Set<string> {
  const text = `${e.name} ${e.address}`.replace(/\b\d{2}-\d{3}\b/g, ' ');
  return new Set(words(text).filter((w) => /^\d+[a-z]?$/.test(w)));
}

/** Основы слов улицы (первые 5 букв): «Rotundzie» и «Rotundą» — одно и то же. */
function streetStems(e: TwinCandidate): Set<string> {
  const cityWords = new Set(words(e.city));
  return new Set(
    words(e.address.replace(/\b\d{2}-\d{3}\b/g, ' '))
      .filter((w) => w.length >= 4 && !/\d/.test(w) && !ADDRESS_NOISE.has(w) && !cityWords.has(w))
      .map((w) => w.slice(0, 5)),
  );
}

/** Лучший двойник: общее слово сети обязательно; затем общий номер (если номера есть у обоих) или улица. */
export function findTwin<T extends TwinCandidate>(orphan: TwinCandidate, candidates: T[]): T | null {
  const b = brand(orphan.name, orphan.city);
  const nums = numbers(orphan);
  const stems = streetStems(orphan);
  let best: { c: T; score: number } | null = null;
  for (const c of candidates) {
    if (c.city.toLowerCase() !== orphan.city.toLowerCase()) continue;
    const cb = brand(c.name, c.city);
    if (![...b].some((w) => cb.has(w))) continue;
    const cn = numbers(c);
    const sharedNums = [...nums].filter((n) => cn.has(n)).length;
    const cs = streetStems(c);
    const sharedStems = [...stems].filter((s) => cs.has(s)).length;
    // Номера есть у обоих и не совпадают — другой пункт сети (Jerozolimskie 50 и 144). Исключение — подробный
    // общий адрес: «Przejście podziemne … Rotund… Metro Centrum» (помещение «34A» в одном источнике и «4» в другом).
    if (nums.size && cn.size && !sharedNums && sharedStems < 3) continue;
    if (!sharedNums && !sharedStems) continue;
    const score = sharedNums * 3 + sharedStems;
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}
