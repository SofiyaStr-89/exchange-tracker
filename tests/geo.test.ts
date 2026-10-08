import { describe, expect, it } from 'vitest';
import { distanceMeters } from '../lib/geo.js';

describe('distanceMeters', () => {
  it('Варшава — Вроцлав около 300 км', () => {
    const d = distanceMeters({ lat: 52.2297, lng: 21.0122 }, { lat: 51.1079, lng: 17.0385 });
    expect(d).toBeGreaterThan(295_000);
    expect(d).toBeLessThan(305_000);
  });

  it('соседние дома — десятки метров', () => {
    const d = distanceMeters({ lat: 52.2298, lng: 20.9982 }, { lat: 52.2302, lng: 20.9982 });
    expect(Math.round(d)).toBe(44);
  });
});
