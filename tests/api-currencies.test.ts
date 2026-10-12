import { describe, expect, it } from 'vitest';
import { GET } from '../api/currencies.js';

describe('GET /api/currencies: проверка параметров (до обращения к базе)', () => {
  it.each([['без страны', ''], ['неизвестная страна', '?country=DE'], ['не код', '?country=pl1']])('%s → 400', async (_name, query) => {
    const response = await GET(new Request(`http://localhost/api/currencies${query}`));
    expect(response.status).toBe(400);
  });
});
