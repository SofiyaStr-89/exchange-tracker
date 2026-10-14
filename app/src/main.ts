import 'leaflet/dist/leaflet.css';
import './style.css';
import L from './leaflet.js';
import { createClusterGroup, type PlateMarker } from './clusters.js';
import { isTooLarge, type Bounds } from '../../lib/bounds.js';
import { distanceMeters } from '../../lib/geo.js';
import { COUNTRY_TIME_ZONE, nextOpening, openState } from '../../lib/hours.js';
import { fetchExchangers, type ApiExchanger } from './api.js';
import { renderCard, type CalcState } from './card.js';
import { renderPlace, type PlaceItem } from './place-card.js';
import { groupByPlace } from './places.js';
import { countryAt, currencyName, loadCurrencies, type Country } from './currencies.js';
import { el } from './dom.js';
import { cleanFavorites, isFavorite, toggleFavorite } from './favorites.js';
import { createFavoritesScreen } from './favorites-screen.js';
import { formatDistance, formatOpens, formatRate, staleLabel } from './format.js';
import { fmt, t } from './i18n/index.js';
import { locate } from './locate.js';
import { createSearch } from './search.js';
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
  bearing?: number;
}
type Point = { lat: number; lng: number };

const state = {
  user: null as Point | null,
  // FR-13: валюта и режим запоминаются на устройстве.
  currency: load<string>('currency', 'USD'),
  mode: load<Mode>('mode', 'buy') === 'sell' ? ('sell' as Mode) : ('buy' as Mode),
  // FR-19: по умолчанию только открытые сейчас.
  openOnly: load<boolean>('openOnly', true) !== false,
  // FR-32: сумма калькулятора общая для всех карточек и запоминается.
  calc: load<CalcState>('calcAmount', { amount: '', direction: 'foreign' }),
  // FR-35: избранное — на устройстве.
  favorites: cleanFavorites(load<unknown>('favorites', [])),
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

// Компас: виден, когда карта повёрнута; нажатие — обратно на север.
const compassButton = el('button', { className: 'locate compass' });
compassButton.type = 'button';
compassButton.setAttribute('aria-label', t.north);
compassButton.title = t.north;
compassButton.innerHTML =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2 16 12H8z" fill="#dc2626"/><path d="M12 22 8 12h8z" fill="currentColor" opacity=".45"/></svg>';
compassButton.hidden = true;

const hint = el('div', { className: 'banner banner-warn' }); // подсказка про геолокацию (FR-2)
const notice = el('div', { className: 'banner' }); // состояние области: пусто, приблизьте…
hint.hidden = notice.hidden = true;
// FR-25–FR-27: поиск города, адреса или места; выбор переносит карту туда (подгрузка — по moveend).
const search = createSearch({
  getCenter: () => map.getCenter(),
  onSelect: (s) => {
    closeCard();
    map.setView([s.lat, s.lng], DEFAULT_ZOOM);
  },
});
top.append(search, controls, hint, notice);
const refreshBadge = el('div', { className: 'refresh-badge', text: t.refreshing });
refreshBadge.hidden = true;
// FR-34: экран «Избранное»; тап по строке — к обменнику на карте и его карточка.
const favoritesScreen = createFavoritesScreen({
  getIds: () => state.favorites,
  getView: () => ({ currency: state.currency, mode: state.mode }),
  onSelect: (e) => {
    map.setView([e.lat, e.lng], Math.max(map.getZoom(), DEFAULT_ZOOM)); // moveend → подгрузка области
    openCard(e);
  },
});
const favoritesButton = el('button', { className: 'chip', text: `★ ${t.favorites}` });
favoritesButton.type = 'button';
favoritesButton.addEventListener('click', () => {
  closeCard();
  favoritesScreen.show();
});
const bottom = el('div', { className: 'bottom' }, el('div', { className: 'bottom-chips' }, openOnlyButton, favoritesButton), refreshBadge, el('div', { className: 'bottom-right' }, compassButton, locateButton));
const card = el('section', { className: 'card' });
card.hidden = true;
app.replaceChildren(mapEl, top, bottom, card, favoritesScreen.element);

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
const map = L.map(mapEl, {
  zoomControl: false,
  // Поворот двумя пальцами (и правой кнопкой мыши на компьютере); свой компас вместо кнопки плагина.
  rotate: true,
  touchRotate: true,
  rotateControl: false,
  bearing: lastView?.bearing ?? 0,
}).setView(lastView ?? WARSAW_CENTER, lastView?.zoom ?? DEFAULT_ZOOM);
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

function saveView(): void {
  const c = map.getCenter();
  save('lastMapView', { lat: c.lat, lng: c.lng, zoom: map.getZoom(), bearing: map.getBearing() } satisfies MapView);
}

map.on('moveend', () => {
  saveView();
  scheduleLoad();
});

function renderCompass(): void {
  const bearing = map.getBearing();
  compassButton.hidden = Math.abs(bearing) < 0.5 || Math.abs(bearing - 360) < 0.5;
  // Стрелка смотрит на север: карта повёрнута на bearing по часовой — стрелка на столько же.
  compassButton.querySelector('svg')!.style.transform = `rotate(${bearing}deg)`;
}

// После поворота видимая область другая — подгрузить (через ту же паузу 0,5 с).
map.on('rotate', () => {
  renderCompass();
  saveView();
  scheduleLoad();
});
compassButton.addEventListener('click', () => map.setBearing(0));
renderCompass();
map.on('click', () => closeCard());

function closeCard(): void {
  card.hidden = true;
}

/** Список пунктов одного места; из карточки пункта — назад к списку. */
function openPlace(group: PlaceItem[]): void {
  renderPlace(card, group, {
    currency: state.currency,
    mode: state.mode,
    onSelect: (e) => openCard(e, () => openPlace(group)),
    onClose: closeCard,
  });
}

function openCard(e: ApiExchanger, onBack?: () => void): void {
  const from = state.user ?? map.getCenter();
  renderCard(card, e, {
    onBack,
    currency: state.currency,
    mode: state.mode,
    calc: state.calc,
    onCalcChange: (calc) => {
      state.calc = calc;
      save('calcAmount', calc);
    },
    favorite: isFavorite(state.favorites, e),
    onToggleFavorite: () => {
      state.favorites = toggleFavorite(state.favorites, e);
      save('favorites', state.favorites);
      openCard(e, onBack);
      renderPlates(); // FR-18: ★ на плашке
    },
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
  const items: PlaceItem[] = [];
  for (const e of withOpen) {
    const value = rateFor(e, state.currency, state.mode);
    if (!e.open && value !== null) closedWithRate++;
    if (!e.open && state.openOnly) continue; // FR-19
    if (value !== null) shown++;
    items.push({
      e,
      value,
      open: e.open,
      // FR-24: курс старше суток — с пометкой возраста, в выборе лучшего не участвует.
      stale: value === null ? null : staleLabel(e.rates[state.currency]!, zoneOf(e)),
      // FR-20: закрытые — бледные с «откроется …».
      next: e.open ? null : nextOpening(e.hours, zoneOf(e)),
      best: best.has(e.id),
    });
  }
  // FR-17: кластер показывает лучший курс только среди открытых со свежим курсом.
  const eligible = (i: PlaceItem) => {
    const rate = i.e.rates[state.currency];
    return i.value !== null && i.open && rate && isFresh(rate) ? i.value : null;
  };
  const better = (a: number, b: number) => (state.mode === 'buy' ? Math.min(a, b) : Math.max(a, b));
  const markers: PlateMarker[] = groupByPlace(items.map((i) => ({ ...i, lat: i.e.lat, lng: i.e.lng }))).map((group) => {
    const single = group.length === 1 ? group[0]! : null;
    // Несколько пунктов в одном месте — одна плашка: лучший курс среди открытых со свежим курсом, иначе любой.
    const values = group.map(eligible).filter((v): v is number => v !== null);
    const anyValues = group.map((i) => i.value).filter((v): v is number => v !== null);
    const value = values.length ? values.reduce(better) : anyValues.length ? anyValues.reduce(better) : null;
    const open = group.some((i) => i.open);
    const isBest = group.some((i) => i.best);
    const stale = single ? single.stale : null;
    const next = single?.next ?? null;
    const classes = [
      'plate',
      single ? '' : 'plate-cluster',
      value === null ? 'plate-none' : isBest ? 'plate-best' : '',
      stale ? 'plate-stale' : '',
      open ? '' : 'plate-closed',
    ];
    const star = group.some((i) => isFavorite(state.favorites, i.e)) ? '<span class="plate-star">★</span>' : ''; // FR-18
    const count = single ? '' : `<span class="cluster-count">${group.length}</span>`;
    const label = star + (value === null ? t.noRateMark : formatRate(value)) + count;
    const opens = [stale, next ? formatOpens(next) : null].filter(Boolean).map((x) => `<small>${x}</small>`).join('');
    const icon = L.divIcon({
      className: 'plate-anchor',
      html: `<div class="${classes.filter(Boolean).join(' ')}">${label}${opens}</div>`,
      iconSize: undefined,
    });
    const title = single ? single.e.name : fmt(t.placeTitle, { n: group.length });
    const marker: PlateMarker = L.marker([group[0]!.lat, group[0]!.lng], { icon, title, riseOnHover: true, zIndexOffset: value === null || !open ? 0 : 1000 });
    marker.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      if (single) openCard(single.e);
      else openPlace(group);
    });
    marker.plateInfo = { eligible: values.length ? values.reduce(better) : null, isBest, count: group.length };
    return marker;
  });
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
  setNotice(fmt(t.emptyNearest, { currency: state.currency, name: first.name, distance: formatDistance(first.distance ?? 0) }), {
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
    setNotice(navigator.onLine ? t.loadError : t.offline);
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

// Сеть вернулась — догрузить область.
window.addEventListener('online', () => scheduleLoad());

// Шаг 12: офлайн-оболочка. В разработке не регистрируем, чтобы кэш не мешал правкам.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

void start();
