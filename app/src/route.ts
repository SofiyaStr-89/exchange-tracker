// Кнопка «Маршрут» (FR-36): ссылка на навигацию до обменника в приложении карт телефона.

export type MapsApp = 'apple' | 'google';
export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(userAgent: string, platform = '', maxTouchPoints = 0): Platform {
  if (/Android/.test(userAgent)) return 'android';
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  // iPadOS представляется Mac'ом, но с сенсорным экраном.
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios';
  return 'other';
}

/** Apple Maps — только на iPhone и только если пользователь не выбрал Google Maps. */
export function mapsAppFor(platform: Platform, preferred: MapsApp | null): MapsApp {
  return platform === 'ios' && preferred !== 'google' ? 'apple' : 'google';
}

/** Пешеходный маршрут от текущего места до точки; координаты пользователя в ссылку не кладём — их берёт само приложение карт. */
export function routeUrl(app: MapsApp, lat: number, lng: number): string {
  const point = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return app === 'apple'
    ? `https://maps.apple.com/?daddr=${point}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${point}&travelmode=walking`;
}
