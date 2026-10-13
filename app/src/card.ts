// Карточка обменника снизу экрана (FR-28).

import { COUNTRY_TIME_ZONE, nextOpening, openState } from '../../lib/hours.js';
import { SOURCE_SITES } from '../../lib/sources.js';
import type { ApiExchanger } from './api.js';
import { el } from './dom.js';
import { rateTime, type ApiRate, type Mode } from './rates.js';
import { calculate, parseAmount, type Direction } from './calculator.js';
import { formatDistance, formatMoney, formatOpens, formatRate, formatUpdated, LOCAL_CURRENCY, staleLabel } from './format.js';
import { fmt, t } from './i18n/index.js';
import { detectPlatform, mapsAppFor, routeUrl, type MapsApp } from './route.js';
import { load, save } from './storage.js';

export interface CalcState {
  amount: string;
  direction: Direction;
}

export interface CardOptions {
  currency: string;
  mode: Mode;
  /** Сумма калькулятора общая для всех карточек (FR-32). */
  calc: CalcState;
  onCalcChange: (calc: CalcState) => void;
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

/** Калькулятор (FR-30–FR-32): поле суммы, кнопка смены направления, итог по курсу этого обменника. */
function calculator(rate: ApiRate, currency: string, local: string, localCode: string, mode: Mode, state: CalcState, onChange: (c: CalcState) => void): HTMLElement {
  const input = el('input', { className: 'calc-input' });
  input.inputMode = 'decimal';
  input.placeholder = '100';
  input.value = state.amount;
  input.setAttribute('aria-label', t.calcLabel);
  const unit = el('span', { className: 'calc-unit' });
  const swap = el('button', { className: 'calc-swap', text: '⇄' });
  swap.type = 'button';
  swap.title = t.calcSwap;
  swap.setAttribute('aria-label', t.calcSwap);
  const result = el('p', { className: 'calc-result' });
  let direction = state.direction;

  const update = () => {
    unit.textContent = direction === 'foreign' ? currency : local;
    const amount = parseAmount(input.value);
    const out = calculate(amount, rate, mode, direction);
    if (!input.value.trim()) result.textContent = '';
    else if (!out) result.textContent = t.calcNoRate;
    else {
      const [from, to] = direction === 'foreign' ? [formatMoney(amount, currency), formatMoney(out.result, localCode)] : [formatMoney(amount, localCode), formatMoney(out.result, currency)];
      const template = mode === 'buy' ? (direction === 'foreign' ? t.calcBuyForeign : t.calcBuyLocal) : direction === 'foreign' ? t.calcSellForeign : t.calcSellLocal;
      result.textContent = fmt(template, { amount: from, result: to });
    }
  };
  input.addEventListener('input', () => {
    update();
    onChange({ amount: input.value, direction });
  });
  swap.addEventListener('click', () => {
    direction = direction === 'foreign' ? 'local' : 'foreign';
    update();
    onChange({ amount: input.value, direction });
  });
  update();
  return el('div', { className: 'calc' }, el('div', { className: 'calc-row' }, input, unit, swap), result);
}

/** Остальные валюты обменника, свёрнуто (FR-29); подписи — с точки зрения пользователя (FR-12). */
function otherCurrencies(e: ApiExchanger, currency: string, local: string): HTMLElement | null {
  const codes = Object.keys(e.rates).filter((c) => c !== currency).sort();
  if (!codes.length) return null;
  const head = el('tr', {}, el('th', { text: t.colCurrency }), el('th', { text: fmt(t.buyLabel, { currency: '' }).trim() }), el('th', { text: fmt(t.sellLabel, { currency: '' }).trim() }));
  const rows = codes.map((code) => {
    const r = e.rates[code]!;
    const cell = (v: number | null) => el('td', { text: v == null ? '—' : `${formatRate(v)} ${local}` });
    return el('tr', {}, el('td', { text: code }), cell(r.sell), cell(r.buy));
  });
  const details = el('details', { className: 'other-currencies' }, el('summary', { text: fmt(t.otherCurrencies, { n: codes.length }) }), el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows)));
  return details;
}

/** «Маршрут» (FR-36); на iPhone под кнопкой — выбор Apple Maps / Google Maps (запоминается в mapsApp). */
function routeBlock(e: ApiExchanger): HTMLElement {
  const platform = detectPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const button = link(t.route, '');
  button.className = 'route-button';
  const wrap = el('div', { className: 'route' }, button);
  const toggle = platform === 'ios' ? el('button', { className: 'route-app' }) : null;
  const update = () => {
    const app = mapsAppFor(platform, load<MapsApp | null>('mapsApp', null));
    button.href = routeUrl(app, e.lat, e.lng);
    if (toggle) toggle.textContent = app === 'apple' ? t.routeInGoogle : t.routeInApple;
  };
  if (toggle) {
    toggle.type = 'button';
    toggle.addEventListener('click', () => {
      const current = mapsAppFor(platform, load<MapsApp | null>('mapsApp', null));
      save('mapsApp', current === 'apple' ? 'google' : 'apple');
      update();
    });
    wrap.append(toggle);
  }
  update();
  return wrap;
}

function hoursLine(e: ApiExchanger, timeZone: string): { text: string; open: boolean; known: boolean } {
  const state = openState(e.hours, timeZone);
  if (!state.known) return { text: t.hoursUnknown, open: true, known: false };
  if (!state.today) return { text: t.todayDayOff, open: state.open, known: true };
  const [from, to] = state.today;
  const text = from === '00:00' && to === '24:00' ? t.roundTheClock : fmt(t.todayHours, { from, to });
  return { text, open: state.open, known: true };
}

export function renderCard(container: HTMLElement, e: ApiExchanger, { currency, mode, calc, onCalcChange, distance, onClose }: CardOptions): void {
  const timeZone = COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw';
  const local = LOCAL_CURRENCY[e.country] ?? '';
  const rate = e.rates[currency];
  const value = (v: number | null | undefined) => (v == null ? t.noRate : `${formatRate(v)} ${local}`);

  const hours = hoursLine(e, timeZone);
  const next = hours.known && !hours.open ? nextOpening(e.hours, timeZone) : null;
  const status = hours.known ? el('span', { className: hours.open ? 'status-open' : 'status-closed', text: hours.open ? t.open : t.closed }) : null;

  const site =
    rate?.source === 'site' && e.website ? { title: t.sourceOwnSite, url: e.website } : rate ? SOURCE_SITES[rate.source] : undefined;
  const sourceLink = site ? link(site.title, site.url) : el('span', { text: rate?.source ?? '' });
  const hasAnyRate = Object.keys(e.rates).length > 0;

  const closeButton = el('button', { className: 'card-close', text: '×' });
  closeButton.setAttribute('aria-label', t.close);
  closeButton.addEventListener('click', onClose);

  const parts: (Node | null)[] = [
    closeButton,
    el('h2', { text: e.name }),
    el('p', { className: 'muted', text: e.bank && e.bank !== e.name ? `${e.bank} · ${e.address}` : e.address }),
    routeBlock(e),
    rate
      ? el(
          'div',
          { className: 'card-rates' },
          // FR-12: подписи с точки зрения пользователя.
          el('div', {}, el('span', { className: 'muted', text: fmt(t.buyLabel, { currency }) }), el('strong', { text: value(rate.sell) })),
          el('div', {}, el('span', { className: 'muted', text: fmt(t.sellLabel, { currency }) }), el('strong', { text: value(rate.buy) })),
        )
      : el('p', { className: 'card-no-rate', text: hasAnyRate ? fmt(t.noRateForCurrency, { currency }) : t.noRatePublished }),
    rate ? calculator(rate, currency, local, e.country === 'PL' ? 'zł' : 'BYN', mode, calc, onCalcChange) : null,
    otherCurrencies(e, currency, local),
    el(
      'p',
      {},
      status,
      status ? document.createTextNode(' · ') : null,
      document.createTextNode(next ? `${formatOpens(next)} · ${hours.text}` : hours.text),
    ),
    rate
      ? el('p', {
          // FR-24: устаревший курс в карточке выделен.
          className: staleLabel(rate, timeZone) ? 'stale-note' : 'muted',
          text: formatUpdated(rateTime(rate).toISOString(), timeZone),
        })
      : null,
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
