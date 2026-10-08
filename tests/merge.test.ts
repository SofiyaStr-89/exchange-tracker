import { describe, expect, it } from 'vitest';
import { mergeDuplicates, similarNames, type Mergeable } from '../lib/merge.js';

const base = { country: 'PL', city: 'Warszawa', bank: null, hours: null, phone: null, website: null };
const p = (id: string, name: string, address: string, lat: number, lng: number, sources: string[], rates: Mergeable['rates'] = {}) => ({
  ...base, id, name, address, lat, lng, sources, rates,
});
const usd = { USD: { buy: 3.8, sell: 3.9, rateUpdatedAt: null, confirmedAt: new Date('2026-10-08T15:00:00Z'), source: 'kantorlive' } };

describe('similarNames', () => {
  it('без слова kantor, регистра и диакритики', () => {
    expect(similarNames('Kantor Złota 65', 'ZLOTA 65 kantor')).toBe(true);
    expect(similarNames('Kantor Tavex Centrum', 'Tavex')).toBe(true);
    expect(similarNames('Kantor Redar', 'Kantor Grosz')).toBe(false);
  });
  it('общее название «Kantor» подходит к любому', () => {
    expect(similarNames('Kantor', 'Kantor Redar')).toBe(true);
  });
  it('домены, «24h» и «całodobowy» не мешают', () => {
    expect(similarNames('Kantor Respol', 'Kantor Respol24h')).toBe(true);
    expect(similarNames('Kantor.com.pl', 'Całodobowy Kantor Polres & Cris')).toBe(true);
  });
  it('слова из адреса не считаются частью названия', () => {
    const ignore = new Set(['leszno', 'okopowa', 'galeria', 'klif']);
    expect(similarNames('Extrakantor Leszno', 'Extrakantor.pl', ignore)).toBe(true);
    expect(similarNames('Kantor Tavex Klif', 'Kantor Tavex (X)', ignore)).toBe(true);
  });
});

describe('mergeDuplicates (правило склейки 1)', () => {
  it('рядом и похожие названия — один обменник; берётся тот, что с курсом', () => {
    const merged = mergeDuplicates([
      { ...p('osm-1', 'Kantor', '', 52.23, 21.01, ['osm']), phone: '+48 1', hours: { mon: ['09:00', '18:00'] as [string, string] } },
      p('kl-1', 'Kantor Redar', 'Marszałkowska 99A, 00-693 Warszawa', 52.23015, 21.0101, ['kantorlive'], usd),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'kl-1', name: 'Kantor Redar', phone: '+48 1', sources: ['kantorlive', 'osm'] });
    expect(merged[0]!.hours).toEqual({ mon: ['09:00', '18:00'] });
    expect(merged[0]!.rates.USD).toBeDefined();
  });

  it('одинаковый адрес и похожее название — один обменник, даже если точки в 100 м', () => {
    const merged = mergeDuplicates([
      p('a', 'Kantor Saska', 'Targowa 46 (lok. 65), 03-733 Warszawa', 52.25, 21.04, ['kantorlive'], usd),
      p('b', 'Saska', 'ul. Targowa 46, 03-733 Warszawa', 52.2509, 21.04, ['marketportal']),
    ]);
    expect(merged).toHaveLength(1);
  });

  it('название-адрес и сайт-название склеиваются с настоящим названием', () => {
    const merged = mergeDuplicates([
      p('a', 'Kantor Klonowa 22', 'Klonowa 22, 00-591 Warszawa', 52.2, 21.0, ['kantorlive'], usd),
      p('b', 'Całodobowy Kantor Polres & Cris', 'Klonowa 22, Warszawa', 52.20003, 21.0, ['marketportal']),
      p('c', 'Kantor.com.pl', 'Klonowa 22, 00-591 Warszawa', 52.20004, 21.00004, ['osm']),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.name).toBe('Całodobowy Kantor Polres & Cris');
  });

  it('разные точки одной сети не склеиваются', () => {
    const merged = mergeDuplicates([
      p('a', 'Kantor Redar pod Novotelem', 'Przejście podziemne pod Novotelem', 52.2295, 21.0118, ['marketportal']),
      p('b', 'Kantor Redar pod Rotundą', 'Przejście podziemne pod Rotundą', 52.2299, 21.0122, ['marketportal']),
    ]);
    expect(merged).toHaveLength(2);
  });

  it('аэропорт: один адрес, разные kantory — не склеиваются', () => {
    const airport = 'Żwirki i Wigury 1, 00-906 Warszawa';
    const merged = mergeDuplicates([
      p('a', 'ICE', airport, 52.1657, 20.9671, ['osm']),
      p('b', 'Money World', airport, 52.1660, 20.9690, ['osm']),
      p('c', 'Air Tours Poland', airport, 52.1662, 20.9693, ['osm']),
    ]);
    expect(merged).toHaveLength(3);
  });

  it('разные kantory в одном торговом центре не склеиваются', () => {
    const merged = mergeDuplicates([
      p('a', 'Kantor Redar', 'Złota 59, 00-120 Warszawa', 52.23, 21.0, ['kantorlive'], usd),
      p('b', 'Kantor Grosz', 'Złota 59/12, 00-120 Warszawa', 52.2301, 21.0001, ['marketportal']),
    ]);
    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });

  it('курсы разных источников объединяются: по валюте — самый свежий', () => {
    const newer = { USD: { ...usd.USD, sell: 3.95, rateUpdatedAt: new Date('2026-10-08T16:00:00Z'), source: 'marketportal' } };
    const merged = mergeDuplicates([
      p('a', 'Kantor X', 'Prosta 1, 00-001 Warszawa', 52.2, 21.0, ['kantorlive'], usd),
      p('b', 'Kantor X', 'Prosta 1, 00-001 Warszawa', 52.2, 21.0, ['marketportal'], newer),
    ]);
    expect(merged[0]!.rates.USD).toMatchObject({ source: 'marketportal', sell: 3.95 });
  });
});
