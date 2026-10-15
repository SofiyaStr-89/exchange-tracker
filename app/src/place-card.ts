// Список обменников одного места (торговый центр, вокзал): название, курс по валюте и режиму, открыт / закрыт.
// Нажатие на строку — карточка этого обменника (FR-28) с возвратом к списку.

import type { NextOpening } from '../../lib/hours.js';
import type { ApiExchanger } from './api.js';
import { currencyShort } from './currencies.js';
import { el } from './dom.js';
import { formatOpens, formatRate, LOCAL_CURRENCY } from './format.js';
import { fmt, t } from './i18n/index.js';
import type { Mode } from './rates.js';

export interface PlaceItem {
  e: ApiExchanger;
  value: number | null;
  open: boolean;
  stale: string | null;
  next: NextOpening | null;
  best: boolean;
}

/** Открытые раньше закрытых, затем лучший курс («Покупаю» — дешевле, «Продаю» — дороже), без курса — в конце. */
export function sortPlace(items: PlaceItem[], mode: Mode): PlaceItem[] {
  const rank = (i: PlaceItem) => (i.value === null ? Infinity : mode === 'buy' ? i.value : -i.value);
  return [...items].sort((a, b) => Number(b.open) - Number(a.open) || rank(a) - rank(b));
}

export function renderPlace(
  container: HTMLElement,
  items: PlaceItem[],
  { currency, mode, onSelect, onClose }: { currency: string; mode: Mode; onSelect: (e: ApiExchanger) => void; onClose: () => void },
): void {
  const close = el('button', { className: 'card-close', text: '×' });
  close.type = 'button';
  close.setAttribute('aria-label', t.close);
  close.addEventListener('click', onClose);
  const label = fmt(mode === 'buy' ? t.buyLabel : t.sellLabel, { currency: currencyShort(currency) });
  const rows = sortPlace(items, mode).map((i) => {
    const local = LOCAL_CURRENCY[i.e.country] ?? '';
    const status = i.open
      ? el('span', { className: 'status-open', text: t.open })
      : el('span', { className: 'status-closed', text: i.next ? formatOpens(i.next) : t.closed });
    const row = el(
      'button',
      { className: 'favorite-row' },
      // «Обменный пункт №100/1053» без названия банка — непонятно, чей; дописываем банк.
      el('strong', { text: i.e.bank && !i.e.name.includes(i.e.bank) ? `${i.e.bank}, ${i.e.name}` : i.e.name }),
      el(
        'span',
        {},
        el('span', {
          className: i.value === null ? 'muted' : i.best ? 'favorite-rate place-best' : 'favorite-rate',
          text: i.value === null ? t.noRate : `${label}: ${formatRate(i.value)} ${local}`,
        }),
        i.stale ? el('span', { className: 'stale-note', text: ` · ${i.stale}` }) : null,
        document.createTextNode(' · '),
        status,
      ),
    );
    row.type = 'button';
    row.addEventListener('click', () => onSelect(i.e));
    return row;
  });
  container.replaceChildren(
    close,
    el('h2', { text: fmt(t.placeTitle, { n: items.length }) }),
    el('p', { className: 'muted', text: items[0]!.e.address }),
    el('div', { className: 'favorites-list' }, ...rows),
  );
  container.hidden = false;
}
