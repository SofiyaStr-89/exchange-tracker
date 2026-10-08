// Карточка обменника снизу экрана (FR-28).

import { COUNTRY_TIME_ZONE, openState } from '../../lib/hours.js';
import { SOURCE_SITES } from '../../lib/sources.js';
import type { ApiExchanger } from './api.js';
import { el } from './dom.js';
import { formatDistance, formatRate, formatUpdated, LOCAL_CURRENCY } from './format.js';
import { fmt, t } from './i18n/index.js';

export interface CardOptions {
  currency: string;
  onClose: () => void;
}

function hoursLine(e: ApiExchanger, timeZone: string): { text: string; open: boolean; known: boolean } {
  const state = openState(e.hours, timeZone);
  if (!state.known) return { text: t.hoursUnknown, open: true, known: false };
  if (!state.today) return { text: t.todayDayOff, open: state.open, known: true };
  const [from, to] = state.today;
  const text = from === '00:00' && to === '24:00' ? t.roundTheClock : fmt(t.todayHours, { from, to });
  return { text, open: state.open, known: true };
}

export function renderCard(container: HTMLElement, e: ApiExchanger, { currency, onClose }: CardOptions): void {
  const timeZone = COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw';
  const local = LOCAL_CURRENCY[e.country] ?? '';
  const rate = e.rates[currency];
  const value = (v: number | null | undefined) => (v == null ? t.noRate : `${formatRate(v)} ${local}`);

  const hours = hoursLine(e, timeZone);
  const status = hours.known ? el('span', { className: hours.open ? 'status-open' : 'status-closed', text: hours.open ? t.open : t.closed }) : null;

  const site = rate ? SOURCE_SITES[rate.source] : undefined;
  const sourceLink = site ? el('a', { text: site.title }) : el('span', { text: rate?.source ?? '' });
  if (site && sourceLink instanceof HTMLAnchorElement) {
    sourceLink.href = site.url;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener';
  }

  const closeButton = el('button', { className: 'card-close', text: '×' });
  closeButton.setAttribute('aria-label', t.close);
  closeButton.addEventListener('click', onClose);

  const parts: (Node | null)[] = [
    closeButton,
    el('h2', { text: e.name }),
    el('p', { className: 'muted', text: e.bank ? `${e.bank} · ${e.address}` : e.address }),
    el(
      'div',
      { className: 'card-rates' },
      // FR-12: подписи с точки зрения пользователя.
      el('div', {}, el('span', { className: 'muted', text: fmt(t.buyLabel, { currency }) }), el('strong', { text: value(rate?.sell) })),
      el('div', {}, el('span', { className: 'muted', text: fmt(t.sellLabel, { currency }) }), el('strong', { text: value(rate?.buy) })),
    ),
    el('p', {}, status, status ? document.createTextNode(' · ') : null, document.createTextNode(hours.text)),
    rate ? el('p', { className: 'muted', text: formatUpdated(rate.rateUpdatedAt ?? rate.confirmedAt, timeZone) }) : null,
    rate ? el('p', { className: 'muted' }, document.createTextNode(t.source), sourceLink) : null,
    el('p', { className: 'muted', text: fmt(t.distance, { distance: formatDistance(e.distance) }) }),
  ];
  container.replaceChildren(...parts.filter((p): p is Node => p !== null));
  container.hidden = false;
}
