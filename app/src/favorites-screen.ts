// Экран «Избранное» (FR-34): название, город, текущий курс по выбранной валюте и режиму, открыт / закрыт.

import { COUNTRY_TIME_ZONE, openState } from '../../lib/hours.js';
import { fetchFavorites, type ApiExchanger } from './api.js';
import { el } from './dom.js';
import { formatRate, LOCAL_CURRENCY, staleLabel } from './format.js';
import { fmt, t } from './i18n/index.js';
import { rateFor, type Mode } from './rates.js';

const REFRESH_RETRY_MS = 3000;
const REFRESH_MAX_RETRIES = 5;

export interface FavoritesScreenOptions {
  getIds: () => string[];
  getView: () => { currency: string; mode: Mode };
  onSelect: (e: ApiExchanger) => void;
  /** Золото из ответа избранного — чтобы оно было в карточке, открытой из списка. */
  onGold?: (gold: Record<string, import('./api.js').ApiGold[]>) => void;
}

export function createFavoritesScreen({ getIds, getView, onSelect, onGold }: FavoritesScreenOptions) {
  const list = el('div', { className: 'favorites-list' });
  const close = el('button', { className: 'card-close', text: '×' });
  close.type = 'button';
  close.setAttribute('aria-label', t.close);
  const screen = el('section', { className: 'favorites' }, close, el('h2', { text: t.favoritesTitle }), list);
  screen.hidden = true;
  screen.setAttribute('aria-label', t.favoritesTitle);
  close.addEventListener('click', () => hide());

  let seq = 0;

  function row(e: ApiExchanger): HTMLElement {
    const { currency, mode } = getView();
    const zone = COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw';
    const value = rateFor(e, currency, mode);
    const state = openState(e.hours, zone);
    const stale = value === null ? null : staleLabel(e.rates[currency]!, zone);
    const rateText =
      value === null
        ? t.noRate
        : `${fmt(mode === 'buy' ? t.buyLabel : t.sellLabel, { currency })}: ${formatRate(value)} ${LOCAL_CURRENCY[e.country] ?? ''}`;
    const button = el(
      'button',
      { className: 'favorite-row' },
      el('strong', { text: e.name }),
      el('span', { className: 'muted', text: e.address.includes(e.city) ? e.address : `${e.city} · ${e.address}` }),
      el(
        'span',
        {},
        el('span', { className: value === null ? 'muted' : 'favorite-rate', text: rateText }),
        stale ? el('span', { className: 'stale-note', text: ` · ${stale}` }) : null,
        state.known
          ? el('span', { className: state.open ? 'status-open' : 'status-closed', text: ` · ${state.open ? t.open : t.closed}` })
          : null,
      ),
    );
    button.type = 'button';
    button.addEventListener('click', () => {
      hide();
      onSelect(e);
    });
    return button;
  }

  async function load(attempt = 0): Promise<void> {
    const ids = getIds();
    const my = ++seq;
    if (!ids.length) return list.replaceChildren(el('p', { className: 'muted', text: t.favoritesEmpty }));
    if (attempt === 0) list.replaceChildren(el('p', { className: 'muted', text: t.loading }));
    try {
      const data = await fetchFavorites(ids);
      if (my !== seq || screen.hidden) return;
      onGold?.(data.gold ?? {});
      const sorted = [...data.exchangers].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
      list.replaceChildren(
        ...(sorted.length ? sorted.map(row) : [el('p', { className: 'muted', text: t.favoritesGone })]),
        ...(data.refreshing ? [el('p', { className: 'muted', text: t.refreshing })] : []),
      );
      if (data.refreshing && attempt < REFRESH_MAX_RETRIES) {
        setTimeout(() => my === seq && !screen.hidden && void load(attempt + 1), REFRESH_RETRY_MS);
      }
    } catch {
      if (my === seq && attempt === 0) list.replaceChildren(el('p', { className: 'muted', text: t.loadError }));
    }
  }

  function show(): void {
    screen.hidden = false;
    void load();
  }

  function hide(): void {
    screen.hidden = true;
    seq++;
  }

  return { element: screen, show, hide };
}
