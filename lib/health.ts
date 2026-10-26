// Оповещение о падении адаптера (SPEC: «Источники»): какие источники сломаны.
// Сломан — к нему обращались в последние двое суток, были ошибки, а удачного сбора нет дольше срока:
// STALE_LIMIT_MS или два обычных интервала источника (OSM собирается раз в неделю — тревога через две).
// Ошибка в одном городе при работающих остальных — не тревога (город мог пропасть у источника).

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_MS = 2 * DAY_MS;
/**
 * Сколько источник может молчать, прежде чем ночная проверка уронит задание (и придёт письмо).
 * Двое суток: kantor.live иногда отвечает 429 (17, 18 и 22.10.2026), на следующий день проходит —
 * одна пропущенная ночь письма не стоит.
 */
export const STALE_LIMIT_MS = 2 * DAY_MS;
/**
 * Для дополнительных источников (не `primary` в lib/collect.ts: kursarz, marketportal, сайты kantorów…) — пять суток:
 * без них приложение работает на основных, а kursarz.pl, например, бывал недоступен по нескольку дней
 * (15–18 и 21–24.10.2026). Сломается всерьёз (вёрстка, закрытие) — письмо всё равно придёт.
 */
export const SECONDARY_STALE_LIMIT_MS = 5 * DAY_MS;

export interface FetchRow {
  source: string;
  status: string;
  fetchedAt: Date | null;
  startedAt: Date | null;
  error: string | null;
}

export interface Broken {
  source: string;
  lastSuccessAt: Date | null;
  error: string;
}

export function brokenSources(
  rows: FetchRow[],
  now: Date,
  maxAgeMs: (source: string) => number,
  isPrimary: (source: string) => boolean = () => true,
): Broken[] {
  const bySource = new Map<string, FetchRow[]>();
  for (const r of rows) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
  const broken: Broken[] = [];
  for (const [source, list] of bySource) {
    const recentErrors = list
      .filter((r) => r.status === 'error' && r.startedAt && now.getTime() - r.startedAt.getTime() <= RECENT_MS)
      .sort((a, b) => b.startedAt!.getTime() - a.startedAt!.getTime());
    if (!recentErrors.length) continue;
    const successes = list.map((r) => r.fetchedAt?.getTime() ?? 0);
    const last = Math.max(0, ...successes);
    const limit = Math.max(isPrimary(source) ? STALE_LIMIT_MS : SECONDARY_STALE_LIMIT_MS, 2 * maxAgeMs(source));
    if (last && now.getTime() - last <= limit) continue;
    broken.push({ source, lastSuccessAt: last ? new Date(last) : null, error: recentErrors[0]!.error ?? 'неизвестная ошибка' });
  }
  return broken.sort((a, b) => a.source.localeCompare(b.source));
}
