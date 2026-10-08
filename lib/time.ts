// Перевод «настенного» времени страны в UTC (правило склейки 6, FR-21).

export type CountryTimeZone = 'Europe/Warsaw' | 'Europe/Minsk';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Смещение пояса относительно UTC в мс в данный момент. */
function offsetMs(utcMs: number, timeZone: string): number {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(utcMs).map((p) => [p.type, p.value]));
  const wallAsUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/** «2026-10-08T16:00:18» или «2026-10-07 17:20:00» по времени timeZone → момент в UTC. Хвост с поясом игнорируется. */
export function zonedWallTimeToUtc(wall: string, timeZone: string): Date {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) throw new Error(`Не понимаю время «${wall}»`);
  const [, y, mo, d, h, mi, s = '0'] = m;
  const guess = Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!, +s);
  let result = guess - offsetMs(guess, timeZone);
  // Повторная поправка на случай перехода на летнее/зимнее время между guess и result.
  result = guess - offsetMs(result, timeZone);
  return new Date(result);
}
