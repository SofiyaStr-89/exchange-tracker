// «Открыт / закрыт» по часам работы и местному времени страны обменника (FR-21, FR-22).

import type { WeekHours } from './db/schema.js';

type Day = keyof WeekHours;
const DAYS: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SHORT: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatters = new Map<string, Intl.DateTimeFormat>();
function localNow(timeZone: string, now: Date): { day: number; minutes: number } {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]));
  return { day: SHORT[parts.weekday!]!, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export interface OpenState {
  open: boolean;
  /** false — часы неизвестны: обменник считается открытым, в карточке «часы работы не указаны». */
  known: boolean;
  /** Часы на сегодня; null — выходной или неизвестно. */
  today: readonly [string, string] | null;
}

export function openState(hours: WeekHours | null, timeZone: string, now = new Date()): OpenState {
  const unknown: OpenState = { open: true, known: false, today: null };
  if (!hours) return unknown;
  const { day, minutes } = localNow(timeZone, now);
  const todayKey = DAYS[day]!;
  if (!(todayKey in hours)) return unknown;
  const today = hours[todayKey] ?? null;

  // Хвост вчерашней смены, если она шла через полночь (например, 22:00–02:00).
  const yesterday = hours[DAYS[(day + 6) % 7]!];
  if (yesterday && toMinutes(yesterday[1]) <= toMinutes(yesterday[0]) && minutes < toMinutes(yesterday[1])) {
    return { open: true, known: true, today };
  }
  if (!today) return { open: false, known: true, today: null };

  const [begin, end] = [toMinutes(today[0]), toMinutes(today[1])];
  const open = end > begin ? minutes >= begin && minutes < end : minutes >= begin;
  return { open, known: true, today };
}

export const COUNTRY_TIME_ZONE: Record<string, string> = { PL: 'Europe/Warsaw', BY: 'Europe/Minsk' };
