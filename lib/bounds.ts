// Прямоугольник видимой области карты: общий для сервера и приложения (FR-3, FR-4).

import { distanceMeters } from './geo.js';

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Максимальная сторона видимой области; больше — «Приблизьте карту» (FR-4). */
export const MAX_SIDE_M = 20_000;

export const boundsCenter = (b: Bounds) => ({ lat: (b.south + b.north) / 2, lng: (b.west + b.east) / 2 });

export function boundsSize(b: Bounds): { width: number; height: number } {
  const mid = (b.south + b.north) / 2;
  return {
    width: distanceMeters({ lat: mid, lng: b.west }, { lat: mid, lng: b.east }),
    height: distanceMeters({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.west }),
  };
}

export const isTooLarge = (b: Bounds) => {
  const { width, height } = boundsSize(b);
  return width > MAX_SIDE_M || height > MAX_SIDE_M;
};

export const inside = (p: { lat: number; lng: number }, b: Bounds) =>
  p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;
