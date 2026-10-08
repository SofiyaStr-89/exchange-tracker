// Города, для которых умеем собирать курсы: центр и id города в каждом источнике.
// Полный список появится на шаге 8 («Все города»).

import type { Country } from './adapters/types.js';
import { distanceMeters } from './geo.js';

export interface City {
  id: string;
  country: Country;
  name: string;
  lat: number;
  lng: number;
  /** Источник → как город называется в этом источнике. */
  sources: Record<string, string>;
}

export const CITIES: City[] = [
  { id: 'pl-warszawa', country: 'PL', name: 'Warszawa', lat: 52.2297, lng: 21.0122, sources: { kantorlive: 'warszawa', osm: 'Warszawa' } },
];

/** Города, которые могут попасть в поиск вокруг точки: центр города не дальше 30 км. */
const CITY_REACH_M = 30_000;

export function citiesNear(point: { lat: number; lng: number }): City[] {
  return CITIES.filter((c) => distanceMeters(point, c) <= CITY_REACH_M);
}
