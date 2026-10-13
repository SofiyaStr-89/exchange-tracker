import { describe, expect, it } from 'vitest';
import { detectPlatform, mapsAppFor, routeUrl } from '../app/src/route.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

describe('route', () => {
  it('определяет платформу', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
    expect(detectPlatform(ANDROID)).toBe('android');
    expect(detectPlatform(ANDROID, 'MacIntel', 5)).toBe('android');
    expect(detectPlatform(MAC, 'MacIntel', 0)).toBe('other');
    expect(detectPlatform(MAC, 'MacIntel', 5)).toBe('ios'); // iPad
  });

  it('iPhone — Apple Maps, если не выбран Google; остальные — Google Maps', () => {
    expect(mapsAppFor('ios', null)).toBe('apple');
    expect(mapsAppFor('ios', 'google')).toBe('google');
    expect(mapsAppFor('android', 'apple')).toBe('google');
    expect(mapsAppFor('other', null)).toBe('google');
  });

  it('строит пешеходный маршрут до точки', () => {
    expect(routeUrl('apple', 52.2297, 21.0122)).toBe('https://maps.apple.com/?daddr=52.229700,21.012200&dirflg=w');
    expect(routeUrl('google', 53.9, 27.5667)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=53.900000,27.566700&travelmode=walking',
    );
  });
});
