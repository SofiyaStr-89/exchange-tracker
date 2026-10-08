// Разбор тега OSM opening_hours в часы по дням (упрощённо, FR-21, FR-22).
// Понимает «Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off», «24/7», перечисления дней и обеденные перерывы
// (берётся от первого открытия до последнего закрытия). Остальное — null: часы неизвестны.

import type { WeekHours } from './db/schema.js';

type Day = keyof WeekHours;
const ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const OSM_DAYS: Record<string, Day> = { Mo: 'mon', Tu: 'tue', We: 'wed', Th: 'thu', Fr: 'fri', Sa: 'sat', Su: 'sun' };
const ALL_DAY: [string, string] = ['00:00', '24:00'];

function parseDays(spec: string): Day[] | null {
  const days: Day[] = [];
  for (const part of spec.split(',').map((p) => p.trim())) {
    const [from, to] = part.split('-').map((d) => OSM_DAYS[d.trim()]);
    if (!from) return null;
    if (!to) {
      days.push(from);
      continue;
    }
    for (let i = ORDER.indexOf(from); ; i = (i + 1) % 7) {
      days.push(ORDER[i]!);
      if (ORDER[i] === to) break;
    }
  }
  return days;
}

function parseTimes(spec: string): [string, string] | null | undefined {
  if (/^(off|closed)$/i.test(spec)) return null;
  const ranges = spec.split(',').map((r) => r.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/));
  if (!ranges.length || ranges.some((r) => !r)) return undefined;
  const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`;
  const first = ranges[0]!;
  const last = ranges.at(-1)!;
  return [pad(first[1]!, first[2]!), pad(last[3]!, last[4]!)];
}

export function parseOpeningHours(raw: string | null | undefined): WeekHours | null {
  const text = raw?.trim();
  if (!text) return null;
  if (text === '24/7') return Object.fromEntries(ORDER.map((d) => [d, ALL_DAY])) as WeekHours;

  const hours: WeekHours = {};
  for (const rule of text.split(';').map((r) => r.trim()).filter(Boolean)) {
    if (/^(PH|SH)\b/.test(rule)) continue; // праздники не учитываем
    const m = rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)[A-Za-z,\- ]*?)\s+(.+)$/);
    const days = m ? parseDays(m[1]!) : ORDER;
    const times = parseTimes(m ? m[2]!.trim() : rule);
    if (!days || times === undefined) return null;
    for (const d of days) hours[d] = times;
  }
  return Object.keys(hours).length ? hours : null;
}
