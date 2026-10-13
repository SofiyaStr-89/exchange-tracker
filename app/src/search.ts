// Строка поиска (FR-25–FR-27): подсказки после 3 символов и 300 мс паузы; города — из нашего списка,
// места и адреса — Photon (по Польше и Беларуси, ближе к центру карты или к городу из «Город, место»);
// Enter без подсказок — один запрос к Nominatim (у него подсказки при вводе запрещены правилами).

import { CITIES_DATA } from '../../lib/cities-data.js';
import { el } from './dom.js';
import { t } from './i18n/index.js';
import { citySuggestions, dedupeSuggestions, photonToSuggestion, splitCityQuery, type Suggestion } from './search-logic.js';

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
    input.value = s.label;
    list.hidden = true;
    input.blur();
    options.onSelect(s);
  };

  const render = (items: Suggestion[], empty = false) => {
    current = items;
    list.replaceChildren(
      ...(items.length
        ? items.map((s) => {
            const button = el('button', { className: 'search-item' }, el('span', { text: s.label }), s.detail ? el('small', { text: s.detail }) : null);
            button.type = 'button';
            // pointerdown, чтобы выбор успел до потери фокуса полем ввода
            button.addEventListener('pointerdown', (ev) => {
              ev.preventDefault();
              choose(s);
            });
            return el('li', {}, button);
          })
        : empty
          ? [el('li', { className: 'search-empty', text: t.searchNothing })]
          : []),
    );
    list.hidden = !items.length && !empty;
  };

  const run = async (query: string) => {
    controller?.abort();
    controller = new AbortController();
    const local = citySuggestions(query, CITIES_DATA);
    const { city, rest } = splitCityQuery(query, CITIES_DATA);
    try {
      const remote = await photon(rest, city ?? options.getCenter(), controller.signal);
      render(dedupeSuggestions([...(city ? [] : local), ...remote]).slice(0, 7), true);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      render(local, true); // Photon недоступен — хотя бы города
    }
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

  input.addEventListener('blur', () => setTimeout(() => (list.hidden = true), 150));
  input.addEventListener('focus', () => {
    if (current.length) list.hidden = false;
  });
  return box;
}
