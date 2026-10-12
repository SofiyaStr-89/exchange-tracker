// Координаты отделений банков Минска с kurs.onliner.by (SPEC: правило склейки 3) и ключ адреса для
// сопоставления белорусских адресов из разных источников.

import { decodeEntities } from './html.js';
import { USER_AGENT } from './probe.js';

export interface OnlinerPoint {
  bank: string;
  address: string;
  lat: number;
  lng: number;
}

const attr = (tag: string, name: string) => decodeEntities(tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '');

/** Все точки со страницы: списки через « | »; у onliner data-latitude — долгота, data-longitude — широта. */
export function parseOnlinerPoints(html: string): OnlinerPoint[] {
  const seen = new Set<string>();
  const points: OnlinerPoint[] = [];
  for (const m of html.matchAll(/<a\b[^>]*data-address="[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const addresses = attr(tag, 'data-address').split(' | ');
    const lngs = attr(tag, 'data-latitude').split(' | ');
    const lats = attr(tag, 'data-longitude').split(' | ');
    const banks = attr(tag, 'data-name').split(', ');
    addresses.forEach((address, i) => {
      const lat = Number(lats[i]);
      const lng = Number(lngs[i]);
      if (!address.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const point = { bank: banks[i]?.trim() ?? '', address: address.trim(), lat, lng };
      const key = `${point.bank}|${point.address}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push(point);
      }
    });
  }
  return points;
}

const STREET_TYPES = /^(ул|улица|пр|пр-т|просп|проспект|тр|тракт|пер|переулок|б-р|бульвар|пл|площадь|ш|шоссе|наб|набережная|мкр|микрорайон|проезд|пр-д|туп|тупик)\.?$/;

/**
 * «тр. Логойский, 10, Минск» → «логойский 10». Понимает «Московская 13», «д. 20», «ул. И. Гошкевича 3»,
 * «156-32» (берётся основной номер 156). Пусто, если нет улицы с номером дома.
 */
export function byAddressKey(address: string): string {
  const text = address
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\.(?=[а-я])/g, '. ') // «ул.богдановича», «я.чечота»
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^(г\.?\s*)?минск$/.test(p) && !/обл\.?|район|с\/с/.test(p))
    .join(', ');
  for (const m of text.matchAll(/([а-яa-z][а-яa-z.\- ]*?)[,\s]+(?:д\.?\s*)?(\d+[а-я]?(?:\/\d+[а-я]?)?)/g)) {
    const street = m[1]!
      .split(/\s+/)
      .filter((w) => w && !STREET_TYPES.test(w) && !/^[а-яa-z]\.$/.test(w) && w !== 'д.' && w !== 'д')
      .join(' ')
      .replace(/["«»]/g, '');
    if (/[а-я]{3,}/.test(street)) return `${street} ${m[2]}`;
  }
  return '';
}

export async function fetchOnlinerPoints(): Promise<OnlinerPoint[]> {
  const res = await fetch('https://kurs.onliner.by/', { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new Error(`onliner: HTTP ${res.status}`);
  return parseOnlinerPoints(await res.text());
}
