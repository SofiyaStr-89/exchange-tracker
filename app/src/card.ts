// Карточка обменника снизу экрана (FR-28).

import { COUNTRY_TIME_ZONE, openState } from '../../lib/hours.js';
import { SOURCE_SITES } from '../../lib/sources.js';
import type { ApiExchanger } from './api.js';
import { el } from './dom.js';
import { formatDistance, formatRate, formatUpdated, LOCAL_CURRENCY } from './format.js';
import { fmt, t } from './i18n/index.js';

export interface CardOptions {
  currency: string;
  /** Расстояние до обменника и от чего оно посчитано (FR-28). */
  distance: { meters: number; fromUser: boolean };
  onClose: () => void;
}

function link(text: string, href: string, external = true): HTMLAnchorElement {
  const a = el('a', { text });
  a.href = href;
  if (external) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  return a;
}

/** Телефон и сайт обменника (FR-15, FR-28); сайт уже проверен на http(s) при сборе. */
function contacts(e: ApiExchanger): HTMLElement | null {
  const parts: Node[] = [];
  if (e.phone) parts.push(document.createTextNode(t.call), link(e.phone, `tel:${e.phone.replace(/[^\d+]/g, '')}`, false));
  if (e.website && /^https?:\/\//.test(e.website)) {
    if (parts.length) parts.push(document.createTextNode(' · '));
    parts.push(link(t.website, e.website));
  }
  return parts.length ? el('p', {}, ...parts) : null;
}

function hoursLine(e: ApiExchanger, timeZone: string): { text: string; open: boolean; known: boolean } {
  const state = openState(e.hours, timeZone);
  if (!state.known) return { text: t.hoursUnknown, open: true, known: false };
  if (!state.today) return { text: t.todayDayOff, open: state.open, known: true };
  const [from, to] = state.today;
  const text = from === '00:00' && to === '24:00' ? t.roundTheClock : fmt(t.todayHours, { from, to });
  return { text, open: state.open, known: true };
}

export function renderCard(container: HTMLElement, e: ApiExchanger, { currency, distance, onClose }: CardOptions): void {
  const timeZone = COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw';
  const local = LOCAL_CURRENCY[e.country] ?? '';
  const rate = e.rates[currency];
  const value = (v: number | null | undefined) => (v == null ? t.noRate : `${formatRate(v)} ${local}`);

  const hours = hoursLine(e, timeZone);
  const status = hours.known ? el('span', { className: hours.open ? 'status-open' : 'status-closed', text: hours.open ? t.open : t.closed }) : null;

  const site = rate ? SOURCE_SITES[rate.source] : undefined;
  const sourceLink = site ? link(site.title, site.url) : el('span', { text: rate?.source ?? '' });
  const hasAnyRate = Object.keys(e.rates).length > 0;

  const closeButton = el('button', { className: 'card-close', text: '×' });
  closeButton.setAttribute('aria-label', t.close);
  closeButton.addEventListener('click', onClose);

  const parts: (Node | null)[] = [
    closeButton,
    el('h2', { text: e.name }),
    el('p', { className: 'muted', text: e.bank ? `${e.bank} · ${e.address}` : e.address }),
    rate
      ? el(
          'div',
          { className: 'card-rates' },
          // FR-12: подписи с точки зрения пользователя.
          el('div', {}, el('span', { className: 'muted', text: fmt(t.buyLabel, { currency }) }), el('strong', { text: value(rate.sell) })),
          el('div', {}, el('span', { className: 'muted', text: fmt(t.sellLabel, { currency }) }), el('strong', { text: value(rate.buy) })),
        )
      : el('p', { className: 'card-no-rate', text: hasAnyRate ? fmt(t.noRateForCurrency, { currency }) : t.noRatePublished }),
    el('p', {}, status, status ? document.createTextNode(' · ') : null, document.createTextNode(hours.text)),
    rate ? el('p', { className: 'muted', text: formatUpdated(rate.rateUpdatedAt ?? rate.confirmedAt, timeZone) }) : null,
    rate ? el('p', { className: 'muted' }, document.createTextNode(t.source), sourceLink) : null,
    contacts(e),
    el('p', {
      className: 'muted',
      text: fmt(distance.fromUser ? t.distance : t.distanceFromCenter, { distance: formatDistance(distance.meters) }),
    }),
  ];
  container.replaceChildren(...parts.filter((p): p is Node => p !== null));
  container.hidden = false;
}
