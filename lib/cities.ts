// Города, для которых умеем собирать курсы: центр и как город называется в каждом источнике.
// Список генерируется из источников (collector/build-cities.ts → cities-data.ts).

import type { Country } from './adapters/types.js';
import { CITIES_DATA } from './cities-data.js';
import { distanceMeters } from './geo.js';

export interface City {
  id: string;
  country: Country;
  name: string;
  lat: number;
  lng: number;
  /** Источник → как город называется в этом источнике. */
  sources: Record<string, string>;
  /** Как город пишут на сайтах (регулярные выражения): проверка, что страница про этот город. */
  aliases: string[];
}

export const CITIES: City[] = CITIES_DATA;

/** Обновляем только ближайший город в 25 км от центра карты: пригороды и деревни-«города» не дёргаем разом. */
const CITY_REACH_M = 25_000;
const MAX_CITIES = 1;

export function citiesNear(point: { lat: number; lng: number }): City[] {
  return CITIES.map((c) => ({ c, d: distanceMeters(point, c) }))
    .filter(({ d }) => d <= CITY_REACH_M)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_CITIES)
    .map(({ c }) => c);
}
