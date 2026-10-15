// Строка поиска (FR-25–FR-27): подсказки после 3 символов и 300 мс паузы; города — из нашего списка,
// места и адреса — Photon (по Польше и Беларуси, ближе к центру карты или к городу из «Город, место»);
// Enter без подсказок — один запрос к Nominatim (у него подсказки при вводе запрещены правилами).

import { hasCyrillic, reverse, toBelarusian, toRussian, type Dictionary } from '../../lib/by-words.js';
import { CITIES_DATA } from '../../lib/cities-data.js';
import { countryAt } from './currencies.js';
import { el } from './dom.js';
import { t } from './i18n/index.js';
import { citySuggestions, dedupeSuggestions, dropNearDuplicates, photonToSuggestion, splitCityQuery, type Suggestion } from './search-logic.js';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;
/** Польша и Беларусь целиком. */
const BBOX = '14.0,49.0,32.8,56.2';

async function photon(query: string, near: { lat: number; lng: number }, signal: AbortSignal): Promise<Suggestion[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '6');
  url.searchParams.set('bbox', BBOX);
  url.searchParams.set('lat', String(near.lat));
  url.searchParams.set('lon', String(near.lng));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Photon: HTTP ${res.status}`);
  const data = (await res.json()) as { features: Parameters<typeof photonToSuggestion>[0][] };
  return data.features.map(photonToSuggestion).filter((s): s is Suggestion => s !== null);
}

// Словарь улиц Беларуси грузим один раз и только когда в запросе кириллица (~200 КБ, в сжатом виде меньше).
let byWords: Promise<{ dict: Dictionary; keys: string[]; back: Dictionary } | null> | null = null;
function loadByWords() {
  byWords ??= fetch('/by-words.json')
    .then((r) => (r.ok ? (r.json() as Promise<Dictionary>) : null))
    .then((dict) => (dict ? { dict, keys: Object.keys(dict), back: reverse(dict) } : null))
    .catch(() => {
      byWords = null; // без сети — попробуем в следующий раз
      return null;
    });
  return byWords;
}

/**
 * Русский запрос по Беларуси: ищем и в переводе на белорусский, и как есть (магазины там часто по-русски).
 * Перевод отвечает быстрее и нужен чаще — его показываем сразу (onPartial), запрос как есть дописываем потом.
 */
async function photonRu(
  query: string,
  near: { lat: number; lng: number },
  signal: AbortSignal,
  onPartial: (items: Suggestion[]) => void,
): Promise<Suggestion[]> {
  const words = await loadByWords();
  const be = words ? toBelarusian(query, words.dict, words.keys) : query;
  if (!words || be === query) return photon(query, near, signal);
  const ru = (s: string | undefined) => (s ? toRussian(s, words.back) : s);
  const toRu = (items: Suggestion[]) => items.map((s) => ({ ...s, label: ru(s.label)!, ...(s.detail ? { detail: ru(s.detail) } : {}) }));
  const quiet = (err: unknown): Suggestion[] => {
    if ((err as Error).name === 'AbortError') throw err;
    return []; // один из двух запросов не ответил — обойдёмся другим
  };
  const original = photon(query, near, signal).catch(quiet);
  original.catch(() => {}); // отмену разберёт await ниже
  const translated = toRu(await photon(be, near, signal).catch(quiet));
  if (translated.length) onPartial(translated);
  return [...translated, ...toRu(await original)];
}

/** Места из нашего справочника (POST: набранное и центр карты — не в адресе запроса). */
async function fetchPlaces(q: string, near: { lat: number; lng: number }, signal: AbortSignal): Promise<Suggestion[]> {
  const res = await fetch('/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, near: { lat: near.lat, lng: near.lng } }),
    signal,
  });
  if (!res.ok) throw new Error(`places: HTTP ${res.status}`);
  return ((await res.json()) as { places: Suggestion[] }).places;
}

async function nominatim(query: string): Promise<Suggestion | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('countrycodes', 'pl,by');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('accept-language', t.locale);
  const res = await fetch(url);
  if (!res.ok) return null;
  const [first] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return first ? { label: first.display_name, lat: Number(first.lat), lng: Number(first.lon) } : null;
}

export function createSearch(options: { getCenter: () => { lat: number; lng: number }; onSelect: (s: Suggestion) => void }): HTMLElement {
  const input = el('input', { className: 'search-input' });
  input.type = 'search';
  input.placeholder = t.searchPlaceholder;
  input.setAttribute('aria-label', t.searchPlaceholder);
  input.enterKeyHint = 'search';
  input.autocomplete = 'off';
  const list = el('ul', { className: 'search-results' });
  list.hidden = true;
  const box = el('div', { className: 'search' }, input, list);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let current: Suggestion[] = [];

  const choose = (s: Suggestion) => {
    controller?.abort(); // запоздавший ответ не должен снова открыть список
    clearTimeout(timer);
    input.value = s.label;
    list.hidden = true;
    input.blur();
    options.onSelect(s);
  };

  /** empty — показать «Ничего не нашлось», если подсказок нет; loading — строка «Ищу…» под уже найденным. */
  const render = (items: Suggestion[], empty = false, loading = false) => {
    current = items;
    list.replaceChildren(
      ...(items.length
        ? items.map((s) => {
            const button = el('button', { className: 'search-item' }, el('span', { text: s.label }), s.detail ? el('small', { text: s.detail }) : null);
            button.type = 'button';
            // Касание не забирает фокус у поля (иначе список спрячется по blur), а выбор — по click:
            // если выбирать на pointerdown, список исчезает под пальцем и «click» достаётся кнопке валюты под ним.
            button.addEventListener('pointerdown', (ev) => ev.preventDefault());
            button.addEventListener('click', () => choose(s));
            return el('li', {}, button);
          })
        : empty
          ? [el('li', { className: 'search-empty', text: t.searchNothing })]
          : []),
      ...(loading ? [el('li', { className: 'search-empty', text: t.searching })] : []),
    );
    list.hidden = !items.length && !empty && !loading;
  };

  const run = async (query: string) => {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const local = citySuggestions(query, CITIES_DATA);
    const { city, rest } = splitCityQuery(query, CITIES_DATA);
    const near = city ?? options.getCenter();
    // Сверху — места (наш список городов и справочник GeoNames, доли секунды), ниже — Photon (адреса, места; медленно).
    let head: Suggestion[] = city ? [] : local;
    let tail: Suggestion[] = [];
    const show = (done: boolean) => render(dedupeSuggestions([...head, ...dropNearDuplicates(tail, head)]).slice(0, 8), done, !done);
    show(false);
    const placesDone = city
      ? Promise.resolve()
      : fetchPlaces(rest, near, signal).then((found) => {
          head = dedupeSuggestions([...local, ...dropNearDuplicates(found, local)]);
          show(false);
        });
    const photonDone = (
      hasCyrillic(rest)
        ? photonRu(rest, near, signal, (items) => {
            tail = items;
            show(false);
          })
        : photon(rest, near, signal)
    ).then((items) => {
      tail = items;
    });
    const results = await Promise.allSettled([placesDone, photonDone]);
    if (signal.aborted) return;
    // Photon недоступен — остаются места; вообще ничего — «Ничего не нашлось».
    if (results.every((r) => r.status === 'rejected')) return render(local, true);
    show(true);
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const query = input.value.trim();
    if (query.length < MIN_CHARS) {
      controller?.abort();
      return render([]);
    }
    timer = setTimeout(() => void run(query), DEBOUNCE_MS);
  });

  input.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Escape') return render([]);
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const first = current[0];
    if (first) return choose(first);
    const query = input.value.trim();
    if (query.length < MIN_CHARS) return;
    const found = await nominatim(query);
    if (found) choose(found);
    else render([], true);
  });

  // С запасом: на iPhone фокус уходит при касании подсказки, а её click приходит чуть позже.
  input.addEventListener('blur', () => setTimeout(() => (list.hidden = true), 300));
  input.addEventListener('focus', () => {
    // Карта в Беларуси — словарь улиц грузим заранее, пока человек начинает печатать.
    if (countryAt(options.getCenter()) === 'BY') void loadByWords();
    if (current.length) list.hidden = false;
  });
  return box;
}
