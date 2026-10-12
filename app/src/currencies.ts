// Список валют для переключателя (FR-10): из реальных данных страны, основные — первыми.

import { t } from './i18n/index.js';

export type Country = 'PL' | 'BY';

/** Основные валюты страны — вверху списка, остальные по числу обменников. */
const FEATURED: Record<Country, string[]> = {
  PL: ['USD', 'EUR', 'GBP', 'CHF'],
  BY: ['USD', 'EUR', 'RUB', 'PLN', 'CNY'],
};

/** Грубая проверка «точка в Беларуси»: по ней выбираем страну для списка валют. */
export function countryAt(p: { lat: number; lng: number }): Country {
  // Граница по Бугу у Бреста около 23,6° в. д.; польский Тересполь у самой границы попадёт в BY — допустимо.
  return p.lat > 51.25 && p.lat < 56.2 && p.lng > 23.6 && p.lng < 32.8 ? 'BY' : 'PL';
}

export function orderCurrencies(country: Country, fromApi: string[]): string[] {
  const featured = FEATURED[country].filter((c) => fromApi.includes(c));
  return [...featured, ...fromApi.filter((c) => !featured.includes(c))];
}

let names: Intl.DisplayNames | null = null;
export function currencyName(code: string): string {
  try {
    names ??= new Intl.DisplayNames([t.locale], { type: 'currency' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

const cache = new Map<Country, Promise<string[]>>();

export function loadCurrencies(country: Country): Promise<string[]> {
  let p = cache.get(country);
  if (!p) {
    p = fetch(`/api/currencies?country=${country}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((b: { currencies: { currency: string }[] }) => orderCurrencies(country, b.currencies.map((c) => c.currency)))
      .catch(() => {
        cache.delete(country);
        return FEATURED[country];
      });
    cache.set(country, p);
  }
  return p;
}
