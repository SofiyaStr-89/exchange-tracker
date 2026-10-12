import 'leaflet/dist/leaflet.css';
import './style.css';
import L from './leaflet.js';
import { createClusterGroup, type PlateMarker } from './clusters.js';
import { isTooLarge, type Bounds } from '../../lib/bounds.js';
import { distanceMeters } from '../../lib/geo.js';
import { COUNTRY_TIME_ZONE, nextOpening, openState } from '../../lib/hours.js';
import { fetchExchangers, type ApiExchanger } from './api.js';
import { renderCard } from './card.js';
import { countryAt, currencyName, loadCurrencies, type Country } from './currencies.js';
import { el } from './dom.js';
import { formatDistance, formatOpens, formatRate, staleLabel } from './format.js';
import { fmt, t } from './i18n/index.js';
import { locate } from './locate.js';
import { bestIds, isFresh, rateFor, type Mode } from './rates.js';
import { load, save } from './storage.js';

const WARSAW_CENTER = { lat: 52.2297, lng: 21.0122 };
/** Около 500 м вокруг на экране телефона (FR-3). */
const DEFAULT_ZOOM = 16;
const LOAD_DELAY_MS = 500; // FR-4: подгрузка через 0,5 с после остановки карты
const REFRESH_RETRY_MS = 3000;
const REFRESH_MAX_RETRIES = 5;

interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}
type Point = { lat: number; lng: number };

const state = {
  user: null as Point | null,
  // FR-13: валюта и режим запоминаются на устройстве.
  currency: load<string>('currency', 'USD'),
  mode: load<Mode>('mode', 'buy') === 'sell' ? ('sell' as Mode) : ('buy' as Mode),
  // FR-19: по умолчанию только открытые сейчас.
  openOnly: load<boolean>('openOnly', true) !== false,
  country: 'PL' as Country,
  exchangers: [] as ApiExchanger[],
  nearest: [] as ApiExchanger[],
};

document.title = t.appTitle;
const app = document.querySelector<HTMLElement>('#app')!;
const mapEl = el('div', { className: 'map' });
const top = el('div', { className: 'top' });

// FR-10, FR-11: переключатели валюты и режима вверху экрана.
const currencySelect = el('select', { className: 'control-select' });
currencySelect.setAttribute('aria-label', t.currencyLabel);
const modeButtons = (['buy', 'sell'] as Mode[]).map((mode) => {
  const b = el('button', { className: 'segment', text: mode === 'buy' ? t.modeBuy : t.modeSell });
  b.type = 'button';
  b.dataset.mode = mode;
  return b;
});
const modeGroup = el('div', { className: 'segmented' }, ...modeButtons);
modeGroup.setAttribute('role', 'group');
modeGroup.setAttribute('aria-label', t.modeLabel);
const controls = el('div', { className: 'controls' }, currencySelect, modeGroup);
const openOnlyButton = el('button', { className: 'chip', text: t.openOnly });
openOnlyButton.type = 'button';
// FR-5: «Ко мне», как в приложениях карт. Иконка — своя статичная разметка, без данных извне.
const locateButton = el('button', { className: 'locate' });
locateButton.type = 'button';
locateButton.setAttribute('aria-label', t.toMe);
locateButton.title = t.toMe;
locateButton.innerHTML =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 3 3 10.5l7.2 2.3L12.5 20z" fill="currentColor"/></svg>';

const hint = el('div', { className: 'banner banner-warn' }); // подсказка про геолокацию (FR-2)
const notice = el('div', { className: 'banner' }); // состояние области: пусто, приблизьте…
hint.hidden = notice.hidden = true;
top.append(controls, hint, notice);
const refreshBadge = el('div', { className: 'refresh-badge', text: t.refreshing });
refreshBadge.hidden = true;
const bottom = el('div', { className: 'bottom' }, openOnlyButton, refreshBadge, locateButton);
const card = el('section', { className: 'card' });
card.hidden = true;
app.replaceChildren(mapEl, top, bottom, card);

function setNotice(text: string | null, action?: { label: string; onClick: () => void }): void {
  notice.replaceChildren();
  notice.hidden = !text;
  if (!text) return;
  notice.append(el('span', { text }));
  if (action) {
    const button = el('button', { className: 'banner-action', text: action.label });
    button.addEventListener('click', action.onClick);
    notice.append(button);
  }
}

function showGeoHint(): void {
  const close = el('button', { className: 'banner-action', text: t.dismiss });
  close.addEventListener('click', () => (hint.hidden = true));
  hint.replaceChildren(el('span', { text: t.geoHint }), close);
  hint.hidden = false;
}

const lastView = load<MapView | null>('lastMapView', null);
const map = L.map(mapEl, { zoomControl: false }).setView(lastView ?? WARSAW_CENTER, lastView?.zoom ?? DEFAULT_ZOOM);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: t.mapAttribution }).addTo(map);
map.attributionControl.setPrefix(false);
const plates = createClusterGroup(() => state.mode).addTo(map);

let loadTimer: ReturnType<typeof setTimeout> | undefined;
let requestSeq = 0;

function currentBounds(): Bounds {
  const b = map.getBounds();
  return { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() };
}

function scheduleLoad(): void {
  clearTimeout(loadTimer);
  loadTimer = setTimeout(() => void loadView(), LOAD_DELAY_MS);
}

map.on('moveend', () => {
  const c = map.getCenter();
  save('lastMapView', { lat: c.lat, lng: c.lng, zoom: map.getZoom() } satisfies MapView);
  scheduleLoad();
});
map.on('click', () => closeCard());

function closeCard(): void {
  card.hidden = true;
}

function openCard(e: ApiExchanger): void {
  const from = state.user ?? map.getCenter();
  renderCard(card, e, {
    currency: state.currency,
    distance: { meters: distanceMeters(from, e), fromUser: state.user !== null },
    onClose: closeCard,
  });
}

const zoneOf = (e: ApiExchanger) => COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw';

function setOpenOnly(value: boolean): void {
  state.openOnly = value;
  save('openOnly', value);
  openOnlyButton.setAttribute('aria-pressed', String(value));
  closeCard();
  renderPlates();
}

openOnlyButton.addEventListener('click', () => setOpenOnly(!state.openOnly));

function renderPlates(): void {
  plates.clearLayers();
  const withOpen = state.exchangers.map((e) => ({ ...e, open: openState(e.hours, zoneOf(e)).open }));
  const best = bestIds(withOpen, state.currency, state.mode); // FR-16: среди открытых видимых
  let shown = 0;
  let closedWithRate = 0;
  const markers: PlateMarker[] = [];
  for (const e of withOpen) {
    const value = rateFor(e, state.currency, state.mode);
    if (!e.open && value !== null) closedWithRate++;
    if (!e.open && state.openOnly) continue; // FR-19
    if (value !== null) shown++;
    // FR-15: без курса — серая плашка с прочерком; FR-20: закрытые — бледные с «откроется …».
    const next = e.open ? null : nextOpening(e.hours, zoneOf(e));
    // FR-24: курс старше суток — с пометкой возраста, в выборе лучшего не участвует.
    const stale = value === null ? null : staleLabel(e.rates[state.currency]!, zoneOf(e));
    const classes = [
      'plate',
      value === null ? 'plate-none' : best.has(e.id) ? 'plate-best' : '',
      stale ? 'plate-stale' : '',
      e.open ? '' : 'plate-closed',
    ];
    const label = value === null ? t.noRateMark : formatRate(value);
    const opens = [stale, next ? formatOpens(next) : null].filter(Boolean).map((s) => `<small>${s}</small>`).join('');
    const icon = L.divIcon({
      className: 'plate-anchor',
      html: `<div class="${classes.filter(Boolean).join(' ')}">${label}${opens}</div>`,
      iconSize: undefined,
    });
    const marker: PlateMarker = L.marker([e.lat, e.lng], { icon, title: e.name, riseOnHover: true, zIndexOffset: value === null || !e.open ? 0 : 1000 });
    marker.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      openCard(e);
    });
    // FR-17: кластер показывает лучший курс только среди открытых со свежим курсом.
    const rate = e.rates[state.currency];
    marker.plateInfo = { eligible: value !== null && e.open && rate && isFresh(rate) ? value : null, isBest: best.has(e.id) };
    markers.push(marker);
  }
  plates.addLayers(markers);
  if (shown) return setNotice(null);

  // FR-9: всё закрыто — предложить показать закрытые.
  if (state.openOnly && closedWithRate) return setNotice(t.allClosed, { label: t.showClosed, onClick: () => setOpenOnly(false) });

  // FR-9: пусто — ближайший обменник с курсом за пределами экрана (при фильтре — открытый, если есть).
  const withRate = state.nearest.filter((e) => rateFor(e, state.currency, state.mode) !== null);
  const openNearest = withRate.filter((e) => openState(e.hours, zoneOf(e)).open);
  const nearest = state.openOnly && openNearest.length ? openNearest : withRate;
  const first = nearest[0];
  if (!first) return setNotice(fmt(t.emptyFar, { currency: state.currency }));
  setNotice(fmt(t.emptyNearest, { currency: state.currency, name: first.name, distance: formatDistance(first.distance) }), {
    label: t.showNearest,
    onClick: () => map.fitBounds(L.latLngBounds([map.getCenter(), ...nearest.map((e) => L.latLng(e.lat, e.lng))]), { padding: [48, 48] }),
  });
}

async function loadView(attempt = 0): Promise<void> {
  const bounds = currentBounds();
  if (isTooLarge(bounds)) {
    plates.clearLayers();
    refreshBadge.hidden = true;
    return setNotice(t.zoomIn); // FR-4
  }
  const seq = ++requestSeq;
  try {
    const data = await fetchExchangers(bounds, state.currency);
    if (seq !== requestSeq) return; // карту уже сдвинули — ответ устарел
    state.exchangers = data.exchangers;
    state.nearest = data.nearest;
    refreshBadge.hidden = !data.refreshing;
    renderPlates();
    if (data.refreshing && attempt < REFRESH_MAX_RETRIES) {
      setTimeout(() => seq === requestSeq && void loadView(attempt + 1), REFRESH_RETRY_MS);
    }
  } catch {
    if (seq !== requestSeq) return;
    refreshBadge.hidden = true;
    setNotice(t.loadError);
  }
}

function renderModeButtons(): void {
  for (const b of modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
}

async function fillCurrencies(country: Country): Promise<void> {
  const list = await loadCurrencies(country);
  if (country !== state.country) return; // пока грузили, карту увели в другую страну
  const codes = list.includes(state.currency) ? list : [state.currency, ...list];
  currencySelect.replaceChildren(
    ...codes.map((code) => {
      const option = el('option', { text: `${code} — ${currencyName(code)}` });
      option.value = code;
      option.selected = code === state.currency;
      return option;
    }),
  );
}

currencySelect.addEventListener('change', () => {
  state.currency = currencySelect.value;
  save('currency', state.currency);
  closeCard();
  renderPlates();
  scheduleLoad(); // «ближайшие» за экраном зависят от валюты (FR-9)
});

modeGroup.addEventListener('click', (ev) => {
  const mode = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-mode]')?.dataset.mode as Mode | undefined;
  if (!mode || mode === state.mode) return;
  state.mode = mode;
  save('mode', mode);
  renderModeButtons();
  closeCard();
  renderPlates(); // FR-16: лучший пересчитывается под режим
});

map.on('moveend', () => {
  const country = countryAt(map.getCenter());
  if (country !== state.country) {
    state.country = country;
    void fillCurrencies(country);
  }
});

let userMarker: L.CircleMarker | null = null;

function showUser(position: Point): void {
  state.user = position;
  if (userMarker) userMarker.setLatLng(position);
  else userMarker = L.circleMarker(position, { radius: 7, className: 'user-dot' }).bindTooltip(t.you).addTo(map);
}

locateButton.addEventListener('click', async () => {
  locateButton.classList.add('locate-busy');
  const position = await locate();
  locateButton.classList.remove('locate-busy');
  if (!position) return showGeoHint(); // FR-2: подсказка, как включить геолокацию
  hint.hidden = true;
  showUser(position);
  map.setView(position, DEFAULT_ZOOM); // moveend → подгрузка области
});

async function start(): Promise<void> {
  renderModeButtons();
  openOnlyButton.setAttribute('aria-pressed', String(state.openOnly));
  state.country = countryAt(map.getCenter());
  void fillCurrencies(state.country);
  setNotice(t.locating);
  const position = await locate();
  if (position) {
    showUser(position);
    setNotice(t.loading);
    map.setView(position, DEFAULT_ZOOM); // moveend → подгрузка
  } else {
    showGeoHint(); // FR-2: карта уже на последнем месте или в центре Варшавы
    setNotice(t.loading);
  }
  scheduleLoad();
}

void start();
