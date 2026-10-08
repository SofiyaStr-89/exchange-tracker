// Склейка одного обменника из нескольких источников (правило склейки 1):
// похожие названия и (одинаковый нормализованный адрес или ближе 30 м).
// Одного адреса мало: в аэропорту, на вокзале и в торговом центре у разных kantorów один адрес.

import type { WeekHours } from './db/schema.js';
import { mergeRates, type RateRow } from './exchangers.js';
import { distanceMeters } from './geo.js';

const NEAR_M = 30;
/** Одинаковый адрес, но координаты разных источников расходятся (геокодер, вход в ТЦ). */
const SAME_ADDRESS_MAX_M = 300;
/** Слова, которые не отличают один kantor от другого: «kantor», «całodobowy», домены, «24h». */
const GENERIC_WORDS = new Set(['kantor', 'kantory', 'wymiany', 'walut', 'exchange', 'calodobowy', 'calodobowo', '24h', 'pl', 'com', 'eu', 'www']);
/** Чьё название, адрес и координаты главнее при склейке: источники с курсами и проверенными адресами. */
const SOURCE_PRIORITY = ['kantorlive', 'marketportal', 'exg', 'sprawa', 'osm'];

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l');

const words = (text: string) => plain(text).split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/** Слова названия без общих слов и без слов из адреса/города («Kantor Klonowa 22» → пусто, «Respol24h» → «respol»). */
function nameTokens(name: string, ignore: Set<string> = new Set()): Set<string> {
  return new Set(
    words(name.replace(/24\s*h\b/gi, ' '))
      .map((w) => w.replace(/24h$/, ''))
      .filter((w) => w.length > 1 && !GENERIC_WORDS.has(w) && !ignore.has(w)),
  );
}

export function similarNames(a: string, b: string, ignore?: Set<string>): boolean {
  const ta = nameTokens(a, ignore);
  const tb = nameTokens(b, ignore);
  if (!ta.size || !tb.size) return true; // «Kantor» без имени подходит к любому
  const common = [...ta].filter((w) => tb.has(w)).length;
  const smaller = Math.min(ta.size, tb.size);
  return common === smaller || common / (ta.size + tb.size - common) >= 0.5;
}

/** «ul. Targowa 46 (lok. 65), 03-733 Warszawa» → «targowa 46»; пусто, если нет улицы с номером. */
export function addressKey(address: string): string {
  let text = address;
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(/\([^()]*\)/g, ' ');
  }
  const first = plain(text.split(',')[0] ?? '')
    .replace(/^(ul|al|pl|os)\.\s*/, '')
    .replace(/^(ulica|aleja|aleje|plac)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /\d/.test(first) ? first : '';
}

export interface Mergeable {
  id: string;
  name: string;
  address: string;
  city?: string;
  lat: number;
  lng: number;
  sources: string[];
  hours: WeekHours | null;
  phone: string | null;
  website: string | null;
  rates: Record<string, Omit<RateRow, 'currency'>>;
}

const priority = (e: Mergeable) => Math.min(...e.sources.map((s) => SOURCE_PRIORITY.indexOf(s)).map((i) => (i < 0 ? 99 : i)));

export function mergeDuplicates<T extends Mergeable>(items: T[]): T[] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const keys = items.map((e) => addressKey(e.address));

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const b = items[j]!;
      const d = distanceMeters(a, b);
      const sameAddress = keys[i] !== '' && keys[i] === keys[j] && d <= SAME_ADDRESS_MAX_M;
      if (!(sameAddress || d <= NEAR_M)) continue;
      // Слова из адресов обоих не считаются частью названия: «Tavex Klif» в «Galeria Klif» — это Tavex.
      const ignore = new Set([...words(a.address), ...words(b.address), ...words(a.city ?? ''), ...words(b.city ?? '')]);
      if (similarNames(a.name, b.name, ignore)) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, T[]>();
  items.forEach((e, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), e]));

  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0]!;
    const sorted = [...group].sort(
      (a, b) =>
        Object.keys(b.rates).length - Object.keys(a.rates).length || priority(a) - priority(b) || a.id.localeCompare(b.id),
    );
    const primary = sorted[0]!;
    // Название — первое, где есть что-то кроме общих слов и своего же адреса («Kantor Klonowa 22» — это адрес).
    const named = sorted.find((e) => nameTokens(e.name, new Set(words(e.address))).size > 0) ?? primary;
    const rows: RateRow[] = group.flatMap((e) => Object.entries(e.rates).map(([currency, r]) => ({ currency, ...r })));
    const merged = mergeRates(rows);
    return {
      ...primary,
      name: named.name,
      address: primary.address || sorted.find((e) => e.address)?.address || '',
      hours: primary.hours ?? sorted.find((e) => e.hours)?.hours ?? null,
      phone: primary.phone ?? sorted.find((e) => e.phone)?.phone ?? null,
      website: primary.website ?? sorted.find((e) => e.website)?.website ?? null,
      sources: [...new Set(sorted.flatMap((e) => e.sources))],
      rates: Object.fromEntries(Object.entries(merged).map(([cur, { currency: _, ...rest }]) => [cur, rest])),
    };
  });
}
