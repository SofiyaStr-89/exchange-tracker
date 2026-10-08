// Форматирование чисел, расстояний и времени для интерфейса.

import { fmt, t } from './i18n/index.js';

const rateFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export const formatRate = (value: number) => rateFormat.format(value);

export function formatDistance(meters: number): string {
  if (meters < 1000) return fmt(t.meters, { n: Math.round(meters / 10) * 10 });
  return fmt(t.kilometers, { n: new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(meters / 1000) });
}

export const LOCAL_CURRENCY: Record<string, string> = { PL: 'zł', BY: 'BYN' };

/** «сегодня в 18:00» или «07.10 в 18:00» по времени страны обменника. */
export function formatUpdated(iso: string, timeZone: string, now = new Date()): string {
  const date = new Date(iso);
  const day = (d: Date) => d.toLocaleDateString('ru-RU', { timeZone, day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('ru-RU', { timeZone, hour: '2-digit', minute: '2-digit' });
  return day(date) === day(now) ? fmt(t.rateUpdatedToday, { time }) : fmt(t.rateUpdatedOn, { date: day(date), time });
}
