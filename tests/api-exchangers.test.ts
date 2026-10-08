import { describe, expect, it } from 'vitest';
import { POST } from '../api/exchangers.js';

const call = (body: string) =>
  POST(new Request('http://localhost/api/exchangers', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }));
const b = (south: unknown, west: unknown, north: unknown, east: unknown) => JSON.stringify({ bounds: { south, west, north, east } });

describe('POST /api/exchangers: проверка тела запроса (до обращения к базе)', () => {
  it.each([
    ['не JSON', 'bounds=1'],
    ['без bounds', '{"lat":52.2,"lng":21}'],
    ['границы строкой', b('52.2', '21', '52.3', '21.1')],
    ['юг севернее севера', b(52.3, 21.0, 52.2, 21.1)],
    ['запад восточнее востока', b(52.2, 21.1, 52.21, 21.0)],
    ['широта вне диапазона', b(89.9, 21.0, 95, 21.1)],
    ['область больше 20 км', b(52.0, 20.8, 52.1, 21.3)],
    ['валюта не ISO-код', JSON.stringify({ bounds: { south: 52.2, west: 21.0, north: 52.21, east: 21.01 }, currency: 'usd$' })],
  ])('%s → 400', async (_name, body) => {
    expect((await call(body)).status).toBe(400);
  });
});
