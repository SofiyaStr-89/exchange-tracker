import { describe, expect, it } from 'vitest';
import { GET } from '../api/exchangers.js';

const call = (query: string) => GET(new Request(`http://localhost/api/exchangers?${query}`));

describe('GET /api/exchangers: проверка параметров (до обращения к базе)', () => {
  it.each([
    ['без координат', 'radius=500'],
    ['без lng', 'lat=52.2'],
    ['широта вне диапазона', 'lat=95&lng=21'],
    ['не число', 'lat=abc&lng=21'],
    ['радиус больше 2000 м', 'lat=52.2&lng=21&radius=2500'],
    ['нулевой радиус', 'lat=52.2&lng=21&radius=0'],
  ])('%s → 400', async (_name, query) => {
    const response = await call(query);
    expect(response.status).toBe(400);
  });
});
