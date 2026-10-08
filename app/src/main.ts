import 'leaflet/dist/leaflet.css';
import './style.css';
import L from 'leaflet';
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
const DEFAULT_ZOOM = 16;
const REFRESH_RETRY_MS = 3000;
const REFRESH_MAX_RETRIES = 5;

interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

const state = {
  center: WARSAW_CENTER,
  radius: 500,
  currency: 'USD',
  mode: 'buy' as Mode,
  exchangers: [] as ApiExchanger[],
};

document.title = t.appTitle;
const app = document.querySelector<HTMLElement>('#app')!;
const mapEl = el('div', { className: 'map' });
const banner = el('div', { className: 'banner' });
banner.hidden = true;
const refreshBadge = el('div', { className: 'refresh-badge', text: t.refreshing });
refreshBadge.hidden = true;
const card = el('section', { className: 'card' });
card.hidden = true;
app.replaceChildren(mapEl, banner, refreshBadge, card);

function showBanner(text: string | null, kind: 'info' | 'warn' = 'info'): void {
  banner.textContent = text ?? '';
  banner.className = `banner banner-${kind}`;
  banner.hidden = !text;
}

const lastView = load<MapView | null>('lastMapView', null);
const map = L.map(mapEl, { zoomControl: false, attributionControl: true }).setView(
  lastView ?? WARSAW_CENTER,
  lastView?.zoom ?? DEFAULT_ZOOM,
);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: t.mapAttribution }).addTo(map);
map.attributionControl.setPrefix(false);
map.on('moveend', () => {
  const c = map.getCenter();
  save('lastMapView', { lat: c.lat, lng: c.lng, zoom: map.getZoom() } satisfies MapView);
});
map.on('click', () => closeCard());

const circle = L.circle(WARSAW_CENTER, { radius: state.radius, className: 'search-circle' }).addTo(map); // FR-3
const plates = L.layerGroup().addTo(map);

function closeCard(): void {
  card.hidden = true;
}

function renderPlates(): void {
  plates.clearLayers();
  const withOpen = state.exchangers.map((e) => ({
    ...e,
    open: openState(e.hours, COUNTRY_TIME_ZONE[e.country] ?? 'Europe/Warsaw').open,
  }));
  const best = bestIds(withOpen, state.currency, state.mode);
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
        renderCard(card, e, { currency: state.currency, onClose: closeCard });
      })
      .addTo(plates);
  }
  if (!shown) showBanner(fmt(t.nothingHere, { radius: formatDistance(state.radius), currency: state.currency }));
}

async function loadExchangers(attempt = 0): Promise<void> {
  try {
    const data = await fetchExchangers(state.center, state.radius);
    state.exchangers = data.exchangers;
    refreshBadge.hidden = !data.refreshing;
    if (banner.className.includes('banner-info')) showBanner(null);
    renderPlates();
    if (data.refreshing && attempt < REFRESH_MAX_RETRIES) {
      setTimeout(() => void loadExchangers(attempt + 1), REFRESH_RETRY_MS);
    }
  } catch {
    refreshBadge.hidden = true;
    showBanner(t.loadError, 'warn');
  }
}

function setSearchPoint(point: { lat: number; lng: number }): void {
  state.center = point;
  circle.setLatLng(point);
}

async function start(): Promise<void> {
  showBanner(t.locating);
  const position = await locate();
  if (position) {
    setSearchPoint(position);
    map.setView(position, DEFAULT_ZOOM);
    L.circleMarker(position, { radius: 7, className: 'user-dot' }).bindTooltip(t.you).addTo(map);
    showBanner(t.loading);
  } else {
    // FR-2: последнее просмотренное место, при первом запуске — центр Варшавы.
    setSearchPoint(lastView ? { lat: lastView.lat, lng: lastView.lng } : WARSAW_CENTER);
    showBanner(t.geoHint, 'warn');
  }
  await loadExchangers();
}

void start();
