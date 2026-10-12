// Адаптер myfin.by (Беларусь, основной): одна страница города /currency/<город> — отделения всех банков,
// курсы USD/EUR/RUB во встроенном JSON (data-branch-converter), время обновления по отделению (только ЧЧ:ММ).
// Отделения Беларусбанка пропускаем — их точнее даёт официальный API. Координат на странице нет.

import { decodeEntities, textOf } from '../html.js';
import { USER_AGENT } from '../probe.js';
import { zonedWallTimeToUtc } from '../time.js';
import { normalizeRate, type AdapterResult, type NormalizedExchanger, type NormalizedRate } from './types.js';

export const SOURCE = 'myfin';
const BASE = 'https://myfin.by';
/** Банки, у которых есть свой (официальный) адаптер. */
const SKIP_BANKS = new Set(['belarusbank']);

/** Названия банков по коду myfin: на странице рядом с банком бывают рекламные баннеры с чужими подписями. */
const BANK_NAMES: Record<string, string> = {
  alfabank: 'Альфа-Банк',
  'bank-vtb': 'Банк ВТБ (Беларусь)',
  belagroprombank: 'Белагропромбанк',
  belarusbank: 'Беларусбанк',
  belgazprombank: 'Белгазпромбанк',
  belinkasgrupp: 'Белинкасгрупп',
  belinvestbank: 'Белинвестбанк',
  belswissbank: 'БСБ Банк',
  bnbank: 'БНБ-Банк',
  'bps-sberbank': 'Сбер Банк',
  btabank: 'БТА Банк',
  bvebank: 'Банк Белвэб',
  dabrabyt: 'Банк Дабрабыт',
  mtbank: 'МТБанк',
  neobank: 'Нео Банк',
  paritetbank: 'Паритетбанк',
  priorbank: 'Приорбанк',
  reshenie: 'Банк Решение',
  'rrb-bank': 'РРБ-Банк',
  statusbank: 'СтатусБанк',
  technobank: 'Технобанк',
  tkbank: 'ТК Банк',
  zepterbank: 'Цептер Банк',
};

/** «г. Минск, тр. Логойский, 10» → «тр. Логойский, 10, Минск» — как у API Беларусбанка. */
export function normalizeByAddress(raw: string): { address: string; city: string } {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const cityPart = parts.find((p) => /^(г|аг|гп|д|п)\.\s*/.test(p));
  const city = cityPart?.replace(/^(г|аг|гп|д|п)\.\s*/, '') ?? '';
  const rest = parts.filter((p) => p !== cityPart);
  return { address: [...rest, city].filter(Boolean).join(', '), city };
}

/** «18:19» сегодня по Минску; если это позже текущего момента — вчера (правило склейки 6). */
function timeToday(hhmm: string, now: Date): Date | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Minsk' }); // ГГГГ-ММ-ДД
  let at = zonedWallTimeToUtc(`${today}T${m[1]!.padStart(2, '0')}:${m[2]}`, 'Europe/Minsk');
  if (at.getTime() > now.getTime() + 5 * 60 * 1000) at = new Date(at.getTime() - 24 * 60 * 60 * 1000);
  return at;
}

export function parseMyfinCity(html: string, citySlug: string, now = new Date()): AdapterResult {
  // Неизвестный банк — название из логотипа в обычной (не рекламной) строке-сводке банка.
  const bankNames = new Map<string, string>(Object.entries(BANK_NAMES));
  for (const m of html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)) {
    const alias = m[1]!.match(/data-bank-sef-alias="([^"]+)"/)?.[1];
    if (!alias || bankNames.has(alias) || /data-row-type="ad"/.test(m[1]!)) continue;
    const alt = m[2]!.match(/bank-logo[^>]*>\s*<img[^>]*alt="([^"]+)"/)?.[1];
    if (alt) bankNames.set(alias, decodeEntities(alt).trim());
  }

  const result: AdapterResult = { exchangers: [], rates: [] };
  for (const m of html.matchAll(/<tr\s+data-bank-sef-alias="([^"]+)"\s+data-has-appointment[\s\S]*?<\/tr>/g)) {
    const [row, alias] = [m[0], m[1]!];
    if (SKIP_BANKS.has(alias)) continue;
    const link = row.match(/href="(\/bank\/[^"/]+\/department\/(\d+)-[^"]*)"[^>]*>([^<]*)<\/a>/);
    const json = row.match(/data-branch-converter="rates" value="([^"]*)"/)?.[1];
    if (!link || !json) continue;
    const { address, city } = normalizeByAddress(textOf(link[3]!));
    const bank = bankNames.get(alias) ?? alias;
    const key = `${alias}-${link[2]}`;
    const id = `by-${citySlug}-${SOURCE}-${key}`;
    result.exchangers.push({
      id,
      country: 'BY',
      city,
      name: bank,
      bank,
      address,
      lat: null,
      lng: null,
      coordsSource: null,
      hours: null,
      sourceIds: { [SOURCE]: key },
      phone: null,
      website: null, // страница отделения на myfin — не сайт обменника; источник указан в карточке отдельно
    } satisfies NormalizedExchanger);

    const updatedAt = timeToday(row.match(/ic-update-time[^>]*><\/i>\s*([\d:]+)/)?.[1] ?? '', now);
    let rates: Record<string, { buy: number; sell: number; multiplier?: number }>;
    try {
      rates = JSON.parse(decodeEntities(json));
    } catch {
      continue;
    }
    for (const [currency, r] of Object.entries(rates)) {
      if (!/^[A-Z]{3}$/.test(currency)) continue;
      const scale = r.multiplier && r.multiplier > 0 ? r.multiplier : 1;
      const buy = normalizeRate(r.buy, scale);
      const sell = normalizeRate(r.sell, scale);
      if (buy === null && sell === null) continue;
      result.rates.push({ exchangerId: id, currency, buy, sell, rateUpdatedAt: updatedAt, source: SOURCE } satisfies NormalizedRate);
    }
  }
  return result;
}

export async function fetchMyfin(citySlug: string): Promise<AdapterResult> {
  const res = await fetch(`${BASE}/currency/${encodeURIComponent(citySlug)}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`myfin.by: HTTP ${res.status}`);
  const result = parseMyfinCity(await res.text(), citySlug);
  if (!result.exchangers.length) throw new Error('myfin.by: на странице нет отделений — сменилась вёрстка?');
  return result;
}
