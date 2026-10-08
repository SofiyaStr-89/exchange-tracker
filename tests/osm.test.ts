import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOverpass } from '../lib/adapters/osm.js';

const sample = JSON.parse(readFileSync(new URL('./fixtures/overpass-sample.json', import.meta.url), 'utf8'));
const result = parseOverpass(sample, 'warszawa', 'Warszawa');

describe('parseOverpass', () => {
  it('точки и контуры (центр); без координат и криптоматы — пропускаются', () => {
    expect(result.exchangers.map((e) => e.id)).toEqual(['pl-warszawa-osm-n101', 'pl-warszawa-osm-w202', 'pl-warszawa-osm-n606']);
    expect(result.rates).toEqual([]);
  });

  it('адрес, часы, телефон, сайт', () => {
    expect(result.exchangers[0]).toMatchObject({
      country: 'PL',
      city: 'Warszawa',
      name: 'Kantor Testowy',
      address: 'Marszałkowska 10, 00-001 Warszawa',
      lat: 52.2301,
      lng: 21.0101,
      coordsSource: 'source',
      hours: { mon: ['09:00', '18:00'] },
      phone: '+48 22 111 22 33',
      website: 'https://testowy.example/',
      sourceIds: { osm: 'n101' },
    });
  });

  it('без названия — «Kantor», без адреса — пусто, сайт не http(s) — null', () => {
    expect(result.exchangers[1]).toMatchObject({ name: 'Kantor', address: '', lat: 52.24, lng: 21.02, phone: '22 444 55 66', website: null });
  });
});
