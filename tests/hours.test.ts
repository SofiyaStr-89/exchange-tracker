import { describe, expect, it } from 'vitest';
import type { WeekHours } from '../lib/db/schema.js';
import { nextOpening, openState } from '../lib/hours.js';

// Четверг 08.10.2026; в Варшаве UTC+2.
const warsaw = (hhmm: string) => new Date(`2026-10-08T${hhmm}:00+02:00`);
const day: [string, string] = ['09:00', '18:00'];
const weekdays: WeekHours = { mon: day, tue: day, wed: day, thu: day, fri: day, sat: null, sun: null };

describe('openState (FR-21, FR-22)', () => {
  it('в рабочие часы — открыт, с часами на сегодня', () => {
    expect(openState(weekdays, 'Europe/Warsaw', warsaw('10:30'))).toEqual({ open: true, known: true, today: ['09:00', '18:00'] });
  });

  it('до открытия и после закрытия — закрыт', () => {
    expect(openState(weekdays, 'Europe/Warsaw', warsaw('08:59')).open).toBe(false);
    expect(openState(weekdays, 'Europe/Warsaw', warsaw('18:00')).open).toBe(false);
  });

  it('считает по времени страны, а не телефона', () => {
    // 07:30 UTC = 09:30 в Варшаве — уже открыт.
    expect(openState(weekdays, 'Europe/Warsaw', new Date('2026-10-08T07:30:00Z')).open).toBe(true);
  });

  it('выходной (null) — закрыт весь день', () => {
    const saturday = new Date('2026-10-10T12:00:00+02:00');
    expect(openState(weekdays, 'Europe/Warsaw', saturday)).toEqual({ open: false, known: true, today: null });
  });

  it('круглосуточно до 24:00', () => {
    expect(openState({ thu: ['00:00', '24:00'] }, 'Europe/Warsaw', warsaw('23:59')).open).toBe(true);
  });

  it('работа после полуночи (22:00–02:00)', () => {
    const late: WeekHours = { wed: ['22:00', '02:00'], thu: ['22:00', '02:00'] };
    expect(openState(late, 'Europe/Warsaw', warsaw('23:00')).open).toBe(true);
    expect(openState(late, 'Europe/Warsaw', warsaw('01:30')).open).toBe(true); // хвост среды
    expect(openState(late, 'Europe/Warsaw', warsaw('12:00')).open).toBe(false);
  });

  it('часы неизвестны — считается открытым (FR-22)', () => {
    expect(openState(null, 'Europe/Warsaw', warsaw('03:00'))).toEqual({ open: true, known: false, today: null });
    expect(openState({ mon: ['09:00', '18:00'] }, 'Europe/Warsaw', warsaw('03:00'))).toEqual({ open: true, known: false, today: null });
  });
});

describe('nextOpening (FR-20)', () => {
  // Четверг 08.10.2026, Варшава.
  it('сегодня позже', () => {
    expect(nextOpening(weekdays, 'Europe/Warsaw', warsaw('07:30'))).toEqual({ inDays: 0, time: '09:00', weekday: 'thu' });
  });

  it('после закрытия — завтра', () => {
    expect(nextOpening(weekdays, 'Europe/Warsaw', warsaw('19:00'))).toEqual({ inDays: 1, time: '09:00', weekday: 'fri' });
  });

  it('в пятницу вечером при выходных в субботу и воскресенье — понедельник', () => {
    const friday = new Date('2026-10-09T20:00:00+02:00');
    expect(nextOpening(weekdays, 'Europe/Warsaw', friday)).toEqual({ inDays: 3, time: '09:00', weekday: 'mon' });
  });

  it('часы неизвестны или ни одного рабочего дня — null', () => {
    expect(nextOpening(null, 'Europe/Warsaw', warsaw('07:30'))).toBeNull();
    expect(nextOpening({ mon: null, sun: null }, 'Europe/Warsaw', warsaw('07:30'))).toBeNull();
  });
});
