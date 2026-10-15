// Форматирование чисел, расстояний и времени для интерфейса.

import type { NextOpening } from '../../lib/hours.js';
import { fmt, t } from './i18n/index.js';
import { isFresh, rateTime, type ApiRate } from './rates.js';

const rateFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const formatRate = (value: number) => rateFormat.format(value);

export function formatDistance(meters: number): string {
  if (meters < 1000) return fmt(t.meters, { n: Math.round(meters / 10) * 10 });
  return fmt(t.kilometers, { n: new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(meters / 1000) });
}

export const LOCAL_CURRENCY: Record<string, string> = { PL: 'zł', BY: 'BYN' };

/** «сегодня в 18:00» или «07.10 в 18:00» по времени страны обменника. */
export function formatUpdated(iso: string, timeZone: string, now = new Date(), today = t.rateUpdatedToday, on = t.rateUpdatedOn): string {
  const date = new Date(iso);
  const day = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone, day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' });
  return day(date) === day(now) ? fmt(today, { time }) : fmt(on, { date: day(date), time });
}

const ON_DAY: Record<NextOpening['weekday'], string> = {
  mon: t.onMon,
  tue: t.onTue,
  wed: t.onWed,
  thu: t.onThu,
  fri: t.onFri,
  sat: t.onSat,
  sun: t.onSun,
};

/** «откроется в 10:00», «откроется завтра в 9:30», «откроется в понедельник в 9:00» (FR-20). */
export function formatOpens(next: NextOpening): string {
  const time = next.time.replace(/^0(\d)/, '$1');
  if (next.inDays === 0) return fmt(t.opensToday, { time });
  if (next.inDays === 1) return fmt(t.opensTomorrow, { time });
  return fmt(t.opensOn, { day: ON_DAY[next.weekday], time });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Пометка устаревшего курса на плашке: «курс от вчера», «курс от 12.09»; свежий — null (FR-23, FR-24). */
export function staleLabel(r: ApiRate, timeZone: string, now = new Date()): string | null {
  if (isFresh(r, now)) return null;
  const day = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone, day: '2-digit', month: '2-digit' });
  const at = rateTime(r);
  return day(at) === day(new Date(now.getTime() - DAY_MS)) ? t.rateFromYesterday : fmt(t.rateFromDate, { date: day(at) });
}

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
const moneyFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** «500,00 $», «1 960,00 zł» — сумма с символом или кодом валюты. */
export function formatMoney(amount: number, currency: string): string {
  return `${moneyFormat.format(amount)} ${SYMBOLS[currency] ?? currency}`;
}
