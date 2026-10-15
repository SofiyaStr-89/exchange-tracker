// Выбор валюты (FR-10) с поиском: валют у обменников десятки, плюс золото — в обычном выпадающем списке
// нужное не найти. Кнопка показывает выбранное; по нажатию — экран со строкой поиска и разделами
// «Основные», «Золото», «Остальные валюты».

import { isGoldCode } from '../../lib/gold.js';
import { currencyName, currencyShort, featuredCurrencies, type Country } from './currencies.js';
import { el } from './dom.js';
import { t } from './i18n/index.js';

const plain = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();

/** Поиск по коду («usd»), названию («злот», «доллар») и «золото»/«gold»/«zloto» для золота. */
export function matchesCurrency(code: string, query: string, name = currencyName(code)): boolean {
  const q = plain(query);
  if (!q) return true;
  const words = [code, name, ...(isGoldCode(code) ? ['золото', 'gold', 'złoto', 'zloto', 'xau'] : [])].map(plain);
  return words.some((w) => w.includes(q));
}

export interface CurrencyPicker {
  button: HTMLButtonElement;
  sheet: HTMLElement;
  setOptions: (codes: string[], country: Country, current: string) => void;
}

export function createCurrencyPicker(onChange: (code: string) => void): CurrencyPicker {
  const button = el('button', { className: 'control-select currency-button' });
  button.type = 'button';
  button.setAttribute('aria-label', t.currencyLabel);
  button.setAttribute('aria-haspopup', 'dialog');

  const search = el('input', { className: 'search-input picker-search' });
  search.type = 'search';
  search.placeholder = t.currencySearch;
  search.setAttribute('aria-label', t.currencySearch);
  search.autocomplete = 'off';
  const list = el('div', { className: 'favorites-list' });
  const close = el('button', { className: 'card-close', text: '×' });
  close.type = 'button';
  close.setAttribute('aria-label', t.close);
  const sheet = el('section', { className: 'favorites picker' }, close, el('h2', { text: t.currencyLabel }), search, list);
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', t.currencyLabel);

  let codes: string[] = [];
  let featured: string[] = [];
  let current = '';

  const label = (code: string) => (isGoldCode(code) ? currencyName(code) : `${code} — ${currencyName(code)}`);

  const row = (code: string) => {
    const b = el(
      'button',
      { className: `favorite-row picker-row${code === current ? ' picker-current' : ''}` },
      isGoldCode(code) ? el('strong', { text: currencyName(code) }) : el('strong', { text: code }),
      isGoldCode(code) ? null : el('span', { className: 'muted', text: currencyName(code) }),
    );
    b.type = 'button';
    b.addEventListener('click', () => {
      hide();
      if (code !== current) onChange(code);
    });
    return b;
  };

  const render = () => {
    const q = search.value;
    const shown = codes.filter((c) => matchesCurrency(c, q));
    const main = shown.filter((c) => featured.includes(c) && !isGoldCode(c));
    const gold = shown.filter(isGoldCode);
    const rest = shown.filter((c) => !main.includes(c) && !gold.includes(c));
    const section = (title: string, items: string[]) => (items.length ? [el('h3', { className: 'gold-title', text: title }), ...items.map(row)] : []);
    list.replaceChildren(
      ...section(t.currencyMain, main),
      ...section(t.goldTitle, gold),
      ...section(t.currencyOther, rest),
      ...(shown.length ? [] : [el('p', { className: 'muted', text: t.searchNothing })]),
    );
  };

  function show(): void {
    search.value = '';
    render();
    sheet.hidden = false;
    search.focus();
  }

  function hide(): void {
    sheet.hidden = true;
  }

  button.addEventListener('click', show);
  close.addEventListener('click', hide);
  search.addEventListener('input', render);
  search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') hide();
    // Enter — первая найденная валюта.
    if (ev.key === 'Enter') list.querySelector<HTMLButtonElement>('.picker-row')?.click();
  });

  return {
    button,
    sheet,
    setOptions(next, country, selected) {
      codes = next.includes(selected) ? next : [selected, ...next];
      featured = featuredCurrencies(country);
      current = selected;
      button.textContent = isGoldCode(selected) ? currencyShort(selected).replace(/^./, (ch) => ch.toUpperCase()) : label(selected);
      if (!sheet.hidden) render();
    },
  };
}
