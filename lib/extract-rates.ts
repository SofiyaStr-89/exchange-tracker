// Общий разборщик курсов с сайтов kantorów (шаг 5а): у каждого сайта своя вёрстка,
// поэтому ищем код валюты и два числа рядом с ним и сверяем с курсом NBP (правило склейки 7).

import { decodeEntities } from './html.js';
import type { MidRates } from './nbp.js';
import { zonedWallTimeToUtc } from './time.js';

/** Основные валюты: курсы kantorów к ним близки к NBP, допуски строже. */
const MAJOR = new Set(['USD', 'EUR', 'GBP', 'CHF']);

/**
 * Допуски относительно среднего курса NBP: покупка в [buyMin; buyMax]·NBP, продажа в [sellMin; sellMax]·NBP.
 * Невозможно для любого источника: продажа заметно ниже NBP или покупка заметно выше (kantor в убытке).
 * strict — для общего разборщика сайтов, где главный риск — чужая строка таблицы;
 * loose — для структурированных данных агрегаторов: грабительский курс аэропорта реален, его надо показать.
 */
const LIMITS = {
  strict: {
    major: { buyMin: 0.93, buyMax: 1.03, sellMin: 0.97, sellMax: 1.07, spread: 0.08 },
    other: { buyMin: 0.7, buyMax: 1.1, sellMin: 0.9, sellMax: 1.3, spread: 0.6 },
  },
  loose: {
    major: { buyMin: 0.6, buyMax: 1.03, sellMin: 0.97, sellMax: 1.4, spread: 0.4 },
    other: { buyMin: 0.3, buyMax: 1.1, sellMin: 0.9, sellMax: 2, spread: 1 },
  },
};
type Profile = keyof typeof LIMITS;

/** Сколько слов после кода валюты смотреть в поисках двух чисел. */
const LOOKAHEAD = 14;
const SCALES = [1, 10, 100, 1000];
/** Слова, которые означают не основной курс: старые доллары, монеты, мелкие купюры. */
const VARIANT = /^(do|bilon\w*|monet\w*|drobne|star[eyaą]\w*|old|przed|coins?)$/i;

export interface SiteRate {
  buy: number | null;
  sell: number | null;
}

type Section = 'retail' | 'unknown' | 'wholesale' | 'coins';
const SECTION_RANK: Record<Section, number> = { retail: 0, unknown: 1, wholesale: 2, coins: 9 };

/** Текст страницы словами: без скриптов, стилей и тегов. */
function words(html: string): string[] {
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
  return text.split(/\s+/).filter(Boolean);
}

/** «3,95», «3.9050(nowy)», «5,12zł» → число; «12.10.2026» — не число. */
const asNumber = (w: string): number | null => {
  const m = w.match(/^\(?(\d{1,5}[.,]\d{1,6})(?![.,]?\d)/);
  return m ? Number.parseFloat(m[1]!.replace(',', '.')) : null;
};

/** «USD», «(USD)», «USD:», «USD-» → «USD»; иначе null. */
const asCode = (w: string): string | null => {
  const letters = w.replace(/[^A-Za-z]/g, '');
  return w.length <= 7 && /^[A-Z]{3}$/.test(letters) && letters.length + 4 >= w.length ? letters : null;
};

function plausible(code: string, buy: number | null, sell: number | null, mid: number, profile: Profile = 'strict'): boolean {
  const lim = LIMITS[profile][MAJOR.has(code) ? 'major' : 'other'];
  if (buy !== null && (buy < mid * lim.buyMin || buy > mid * lim.buyMax)) return false;
  if (sell !== null && (sell < mid * lim.sellMin || sell > mid * lim.sellMax)) return false;
  if (buy !== null && sell !== null) {
    if (MAJOR.has(code) ? buy >= sell : buy > sell) return false;
    if ((sell - buy) / mid > lim.spread) return false;
  }
  return buy !== null || sell !== null;
}

/**
 * Сверка курса любого источника с NBP (правило склейки 7, мягкие допуски): продажа ниже NBP или покупка
 * выше NBP — курс целиком null; сторона, слишком далёкая от NBP (мусор), отбрасывается. Валюту без курса NBP
 * проверить нечем.
 */
export function sanitizeRate(code: string, buy: number | null, sell: number | null, mids: MidRates): SiteRate | null {
  const mid = mids[code];
  if (!mid) return buy === null && sell === null ? null : { buy, sell };
  const lim = LIMITS.loose[MAJOR.has(code) ? 'major' : 'other'];
  // Kantor в убытке — значит, таблица устаревшая или чужая: не верим ни одной стороне.
  if ((sell !== null && sell < mid * lim.sellMin) || (buy !== null && buy > mid * lim.buyMax)) return null;
  const b = buy !== null && plausible(code, buy, null, mid, 'loose') ? buy : null;
  const s = sell !== null && plausible(code, null, sell, mid, 'loose') ? sell : null;
  if (b === null && s === null) return null;
  if (b !== null && s !== null && !plausible(code, b, s, mid, 'loose')) return null;
  return { buy: b, sell: s };
}

/** Подбирает масштаб (за 1, 10, 100, 1000 единиц), при котором числа похожи на курс; при надобности меняет колонки местами. */
function fit(code: string, first: number, second: number, mid: number): SiteRate | null {
  const round = (v: number) => Math.round(v * 1e8) / 1e8;
  for (const scale of SCALES) {
    const a = first > 0 ? round(first / scale) : null;
    const b = second > 0 ? round(second / scale) : null;
    if (a !== null && b !== null) {
      // Обычно сначала kupno, потом sprzedaż; если наоборот — меняем местами.
      const [buy, sell] = a <= b ? [a, b] : [b, a];
      if (plausible(code, buy, sell, mid)) return { buy, sell };
    } else if (plausible(code, a, b, mid)) {
      return { buy: a, sell: b };
    }
  }
  return null;
}

export function extractRates(html: string, mids: MidRates): Record<string, SiteRate> {
  const list = words(html);
  const best: Record<string, { rate: SiteRate; rank: number }> = {};
  let section: Section = 'unknown';

  for (let i = 0; i < list.length; i++) {
    const word = list[i]!;
    const lower = word.toLowerCase();
    if (/^hurt/.test(lower)) section = 'wholesale';
    else if (/^detal/.test(lower)) section = 'retail';
    else if (/^bilon$/.test(lower) && list.slice(i + 1, i + 4).some((w) => /^walut/i.test(w))) section = 'coins';

    const code = asCode(word);
    if (!code || code === 'PLN' || !mids[code] || section === 'coins') continue;

    // Слова строки до кода (до предыдущего числа) и после него — до первого числа.
    const before: string[] = [];
    for (let k = i - 1; k >= Math.max(0, i - 6) && asNumber(list[k]!) === null; k--) before.push(list[k]!);
    const numbers: number[] = [];
    const between: string[] = [];
    for (let j = i + 1; j < Math.min(list.length, i + 1 + LOOKAHEAD) && numbers.length < 2; j++) {
      const w = list[j]!;
      const n = asNumber(w);
      if (n !== null) numbers.push(n);
      else if (asCode(w) && mids[asCode(w)!]) break; // началась следующая строка с валютой
      else if (!numbers.length) between.push(w);
    }
    if (numbers.length < 2 || [...before, ...between].some((w) => VARIANT.test(w.replace(/[^\p{L}]/gu, '')))) continue;

    const rate = fit(code, numbers[0]!, numbers[1]!, mids[code]!);
    const rank = SECTION_RANK[section];
    if (rate && (!best[code] || rank < best[code]!.rank)) best[code] = { rate, rank };
  }
  return Object.fromEntries(Object.entries(best).map(([code, { rate }]) => [code, rate]));
}

const TS_KEYWORDS = /(aktualiz\w*|kurs\w* z dnia|kursów z|stan na|zaktualizowano|ostatnia zmiana|dane kursów z)/i;

/** Время обновления курсов на странице (время Варшавы); null — не найдено или из будущего. */
export function extractTimestamp(html: string, now = new Date()): Date | null {
  const text = words(html).join(' ');
  for (const m of text.matchAll(new RegExp(TS_KEYWORDS.source, 'gi'))) {
    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    let wall: string | null = null;
    const iso = tail.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T\-–,]+(\d{1,2}):(\d{2}))?/);
    const pl = tail.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
    if (iso && (!pl || iso.index! <= pl.index!)) {
      wall = `${iso[1]}-${iso[2]}-${iso[3]}T${(iso[4] ?? '00').padStart(2, '0')}:${iso[5] ?? '00'}`;
    } else if (pl) {
      const year = pl[3]!.length === 2 ? `20${pl[3]}` : pl[3]!;
      wall = `${year}-${pl[2]!.padStart(2, '0')}-${pl[1]!.padStart(2, '0')}T${(pl[4] ?? '00').padStart(2, '0')}:${pl[5] ?? '00'}`;
    }
    if (!wall) continue;
    try {
      const at = zonedWallTimeToUtc(wall, 'Europe/Warsaw');
      if (Number.isNaN(at.getTime()) || at.getTime() > now.getTime() + 60 * 60 * 1000) return null;
      return at;
    } catch {
      continue;
    }
  }
  return null;
}
