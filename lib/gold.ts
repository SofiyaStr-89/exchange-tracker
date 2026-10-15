// Проверка цен золота (как правило склейки 7 для валют): kantor за 1 г пробы сверяем с ценой NBP за 1 г чистого
// золота, пересчитанной на пробу. Скупка (kantor покупает) бывает сильно ниже рынка — лом; продажа ниже рынка
// или любая сторона заметно выше — ошибка ввода. Неправдоподобная сторона отбрасывается.

import type { NormalizedGold } from './adapters/types.js';

const BUY_RANGE: [number, number] = [0.3, 1.15];
const SELL_RANGE: [number, number] = [0.75, 1.6];

export function sanitizeGold(items: NormalizedGold[], nbpGram: number | null): NormalizedGold[] {
  return items.flatMap((g) => {
    let { buy, sell } = g;
    if (g.kind === 'purity' && nbpGram) {
      const purity = Number.parseInt(g.item, 10);
      const expected = (nbpGram * purity) / 1000;
      if (!(purity > 0 && purity <= 1000)) return [];
      if (buy !== null && (buy < expected * BUY_RANGE[0] || buy > expected * BUY_RANGE[1])) buy = null;
      if (sell !== null && (sell < expected * SELL_RANGE[0] || sell > expected * SELL_RANGE[1])) sell = null;
    }
    // Покупка дороже продажи — перепутаны столбцы или опечатка: не показываем ни одну сторону.
    if (buy !== null && sell !== null && buy > sell) return [];
    return buy === null && sell === null ? [] : [{ ...g, buy, sell }];
  });
}

/** Ключ банка Беларуси для золота: как называет банк myfin («МТбанк» и «МТБанк» — один банк). */
export const bankKey = (name: string) => `bank:${name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')}`;

/** Ключи золота обменника: его id из всех источников (kantor) и банк целиком (Беларусь). */
export function goldOwners(e: { country: string; bank: string | null; memberIds?: string[]; id: string }): string[] {
  return [...(e.memberIds ?? [e.id]), ...(e.country === 'BY' && e.bank ? [bankKey(e.bank)] : [])];
}
