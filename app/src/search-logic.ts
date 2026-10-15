// Логика поиска (FR-25–FR-27) без DOM: подсказки городов из нашего списка, разбор «Город, место»,
// приведение ответа Photon к подсказке.

export interface SearchCity {
  id: string;
  country: 'PL' | 'BY';
  name: string;
  lat: number;
  lng: number;
}

export interface Suggestion {
  label: string;
  detail?: string;
  lat: number;
  lng: number;
}

const COUNTRIES = new Set(['PL', 'BY']);

const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/ё/g, 'е')
    .trim();

/** Города из нашего списка по началу названия — Photon плохо понимает русские названия белорусских городов. */
export function citySuggestions(query: string, cities: SearchCity[], limit = 3): Suggestion[] {
  const q = plain(query);
  if (!q) return [];
  return cities
    .filter((c) => plain(c.name).startsWith(q))
    .slice(0, limit)
    .map((c) => ({ label: c.name, lat: c.lat, lng: c.lng }));
}

/** «Минск, вокзал» → город из списка и место для поиска рядом с ним. */
export function splitCityQuery(query: string, cities: SearchCity[]): { city: SearchCity | null; rest: string } {
  const comma = query.indexOf(',');
  if (comma > 0) {
    const head = plain(query.slice(0, comma));
    const city = cities.find((c) => plain(c.name) === head);
    const rest = query.slice(comma + 1).trim();
    if (city && rest) return { city, rest };
  }
  return { city: null, rest: query.trim() };
}

interface PhotonFeature {
  properties: Record<string, string | undefined>;
  geometry: { coordinates: [number, number] };
}

export function photonToSuggestion(f: PhotonFeature): Suggestion | null {
  const p = f.properties;
  if (!COUNTRIES.has(p.countrycode ?? '')) return null;
  const [lng, lat] = f.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const label = p.name ?? street;
  if (!label) return null;
  const detail = [p.name ? street : '', p.city ?? p.county ?? p.state].filter(Boolean).join(', ');
  return detail ? { label, detail, lat, lng } : { label, lat, lng };
}

/** Убирает повторы с тем же названием и адресом (в OSM у вокзала отдельно трамвайная и автобусная остановки). */
export function dedupeSuggestions(items: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = `${s.label}|${s.detail ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** То же место из другого источника (одно название, ближе 3 км) — повтор: «Колодищи» из справочника и из Photon. */
export function dropNearDuplicates(items: Suggestion[], existing: Suggestion[], km = 3): Suggestion[] {
  const same = (a: Suggestion, b: Suggestion) =>
    plain(a.label) === plain(b.label) && Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180)) <= km;
  return items.filter((s) => !existing.some((e) => same(s, e)));
}
