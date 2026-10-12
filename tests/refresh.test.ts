import { describe, expect, it } from 'vitest';
import { decideRefresh } from '../lib/refresh.js';

const now = new Date('2026-10-12T15:00:00Z');
const min = (m: number) => new Date(now.getTime() - m * 60_000);
const wanted = [
  { source: 'kantorlive', city: 'warszawa' },
  { source: 'sprawa', city: 'warszawa' },
];
const maxAge = (source: string) => (source === 'osm' ? 7 * 24 * 60 : 15) * 60_000;

describe('decideRefresh', () => {
  it('у города нет данных ни из одного источника — ждём сбора всех', () => {
    const plan = decideRefresh(wanted, [], now, maxAge);
    expect(plan.firstTime).toEqual(wanted);
    expect(plan.stale).toEqual([]);
  });

  it('новый источник при уже собранном городе — в фоне, а не ожиданием', () => {
    const plan = decideRefresh(wanted, [{ source: 'kantorlive', city: 'warszawa', fetchedAt: min(5), startedAt: min(5), status: 'ok' }], now, maxAge);
    expect(plan.firstTime).toEqual([]);
    expect(plan.stale).toEqual([{ source: 'sprawa', city: 'warszawa' }]);
  });

  it('источник недавно упал — не дёргаем до конца его срока', () => {
    const rows = [
      { source: 'kantorlive', city: 'warszawa', fetchedAt: min(5), startedAt: min(5), status: 'ok' as const },
      { source: 'sprawa', city: 'warszawa', fetchedAt: null, startedAt: min(3), status: 'error' as const },
    ];
    expect(decideRefresh(wanted, rows, now, maxAge).stale).toEqual([]);
    const later = decideRefresh(wanted, rows, new Date(now.getTime() + 13 * 60_000), maxAge);
    expect(later.stale).toContainEqual({ source: 'sprawa', city: 'warszawa' });
  });

  it('устаревшие — в фоне; время данных — самое старое среди источников курсов', () => {
    const plan = decideRefresh(
      wanted,
      [
        { source: 'kantorlive', city: 'warszawa', fetchedAt: min(20), startedAt: min(20), status: 'ok' },
        { source: 'sprawa', city: 'warszawa', fetchedAt: min(10), startedAt: min(10), status: 'ok' },
      ],
      now,
      maxAge,
    );
    expect(plan.stale).toEqual([{ source: 'kantorlive', city: 'warszawa' }]);
    expect(plan.oldestFetchedAt).toEqual(min(20));
  });
});

describe('decideRefresh: повтор после сбоя', () => {
  it('источник с недельным сроком после сбоя повторяется через час, а не через неделю', () => {
    const weekly = (s: string) => (s === 'osm' ? 7 * 24 * 60 * 60_000 : 15 * 60_000);
    const rows = [
      { source: 'kantorlive', city: 'warszawa', fetchedAt: min(5), startedAt: min(5), status: 'ok' as const },
      { source: 'osm', city: 'warszawa', fetchedAt: null, startedAt: min(61), status: 'error' as const },
    ];
    const plan = decideRefresh([{ source: 'kantorlive', city: 'warszawa' }, { source: 'osm', city: 'warszawa' }], rows, now, weekly);
    expect(plan.stale).toEqual([{ source: 'osm', city: 'warszawa' }]);
  });
});

describe('decideRefresh: первый сбор города — ждём только основные источники', () => {
  it('основные — сразу, остальные — в фоне', () => {
    const jobs = [
      { source: 'kantorlive', city: 'krakow' },
      { source: 'marketportal', city: 'krakow' },
      { source: 'osm', city: 'Kraków' },
    ];
    const plan = decideRefresh(jobs, [], now, maxAge, (s) => s === 'kantorlive');
    expect(plan.firstTime).toEqual([{ source: 'kantorlive', city: 'krakow' }]);
    expect(plan.stale).toEqual([
      { source: 'marketportal', city: 'krakow' },
      { source: 'osm', city: 'Kraków' },
    ]);
  });
});
