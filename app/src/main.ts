import 'leaflet/dist/leaflet.css';
import './style.css';
import L from 'leaflet';
import { isTooLarge, type Bounds } from '../../lib/bounds.js';
import { distanceMeters } from '../../lib/geo.js';
import { COUNTRY_TIME_ZONE, openState } from '../../lib/hours.js';
import { fetchExchangers, type ApiExchanger } from './api.js';
import { renderCard } from './card.js';
import { el } from './dom.js';
import { formatDistance, formatRate } from './format.js';
import { fmt, t } from './i18n/index.js';
import { locate } from './locate.js';
import { bestIds, rateFor, type Mode } from './rates.js';
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
  currency: 'USD',
  mode: 'buy' as Mode,
  exchangers: [] as ApiExchanger[],
  nearest: [] as ApiExchanger[],
};

document.title = t.appTitle;
const app = document.querySelector<HTMLElement>('#app')!;
const mapEl = el('div', { className: 'map' });
const top = el('div', { className: 'top' });
const hint = el('div', { className: 'banner banner-warn' }); // подсказка про геолокацию (FR-2)
const notice = el('div', { className: 'banner' }); // состояние области: пусто, приблизьте…
hint.hidden = notice.hidden = true;
top.append(hint, notice);
const refreshBadge = el('div', { className: 'refresh-badge', text: t.refreshing });
refreshBadge.hidden = true;
const card = el('section', { className: 'card' });
card.hidden = true;
app.replaceChildren(mapEl, top, refreshBadge, card);

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
const plates = L.layerGroup().addTo(map);

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

function renderPlates(): void {
  plates.clearLayers();
  const withOpen = state.exchangers.map((e) => ({
    ...e,
    open: openState(e.hours, COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw').open,
  }));
  const best = bestIds(withOpen, state.currency, state.mode); // FR-16: среди видимых
  let shown = 0;
  for (const e of withOpen) {
    const value = rateFor(e, state.currency, state.mode);
    if (value === null) continue; // FR-15
    shown++;
    const icon = L.divIcon({
      className: 'plate-anchor',
      html: `<div class="plate${best.has(e.id) ? ' plate-best' : ''}">${formatRate(value)}</div>`,
      iconSize: undefined,
    });
    L.marker([e.lat, e.lng], { icon, title: e.name, riseOnHover: true })
      .on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        openCard(e);
      })
      .addTo(plates);
  }
  if (shown) return setNotice(null);

  // FR-9: пусто — ближайший обменник с курсом за пределами экрана.
  const nearest = state.nearest.filter((e) => rateFor(e, state.currency, state.mode) !== null);
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

async function start(): Promise<void> {
  setNotice(t.locating);
  const position = await locate();
  if (position) {
    state.user = position;
    L.circleMarker(position, { radius: 7, className: 'user-dot' }).bindTooltip(t.you).addTo(map);
    setNotice(t.loading);
    map.setView(position, DEFAULT_ZOOM); // moveend → подгрузка
  } else {
    showGeoHint(); // FR-2: карта уже на последнем месте или в центре Варшавы
    setNotice(t.loading);
  }
  scheduleLoad();
}

void start();
