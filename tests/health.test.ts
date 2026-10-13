import { describe, expect, it } from 'vitest';
import { brokenSources, type FetchRow } from '../lib/health.js';

const now = new Date('2026-10-14T03:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
const row = (r: Partial<FetchRow>): FetchRow => ({ source: 'marketportal', status: 'ok', fetchedAt: hoursAgo(1), startedAt: hoursAgo(1), error: null, ...r });
const maxAge = (s: string) => (s === 'osm' ? 7 * 24 * 3600_000 : 30 * 60_000);

describe('оповещение о падении адаптера', () => {
  it('работает — тишина', () => {
    expect(brokenSources([row({})], now, maxAge)).toEqual([]);
  });

  it('ошибки и нет удачных сборов больше суток — сломан', () => {
    const broken = brokenSources([row({ status: 'error', error: 'HTTP 500', fetchedAt: hoursAgo(30), startedAt: hoursAgo(2) })], now, maxAge);
    expect(broken).toEqual([{ source: 'marketportal', lastSuccessAt: hoursAgo(30), error: 'HTTP 500' }]);
  });

  it('ни одного удачного сбора — сломан', () => {
    expect(brokenSources([row({ source: 'sprawa', status: 'error', error: 'fetch failed', fetchedAt: null })], now, maxAge)).toHaveLength(1);
  });

  it('ошибка в одном городе, в другом работает — не тревога', () => {
    const rows = [row({ status: 'error', error: 'HTTP 404', fetchedAt: null, startedAt: hoursAgo(3) }), row({ fetchedAt: hoursAgo(2) })];
    expect(brokenSources(rows, now, maxAge)).toEqual([]);
  });

  it('старая ошибка, к источнику давно не обращались — не тревога', () => {
    expect(brokenSources([row({ status: 'error', error: 'x', fetchedAt: null, startedAt: hoursAgo(100) })], now, maxAge)).toEqual([]);
  });

  it('OSM раз в неделю: успех 10 дней назад — ещё не тревога, 15 — тревога', () => {
    const osm = (days: number) => [row({ source: 'osm', status: 'error', error: 'Overpass 504', fetchedAt: hoursAgo(days * 24), startedAt: hoursAgo(5) })];
    expect(brokenSources(osm(10), now, maxAge)).toEqual([]);
    expect(brokenSources(osm(15), now, maxAge)).toHaveLength(1);
  });
});
