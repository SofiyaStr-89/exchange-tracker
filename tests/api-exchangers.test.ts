import { describe, expect, it } from 'vitest';
import { POST } from '../api/exchangers.js';

const call = (body: string) =>
  POST(new Request('http://localhost/api/exchangers', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }));

describe('POST /api/exchangers: проверка тела запроса (до обращения к базе)', () => {
  it.each([
    ['не JSON', 'lat=52.2&lng=21'],
    ['без координат', '{"radius":500}'],
    ['без lng', '{"lat":52.2}'],
    ['координаты строкой', '{"lat":"52.2","lng":"21"}'],
    ['широта вне диапазона', '{"lat":95,"lng":21}'],
    ['радиус больше 2000 м', '{"lat":52.2,"lng":21,"radius":2500}'],
    ['нулевой радиус', '{"lat":52.2,"lng":21,"radius":0}'],
  ])('%s → 400', async (_name, body) => {
    const response = await call(body);
    expect(response.status).toBe(400);
  });
});
