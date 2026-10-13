// Калькулятор в карточке (FR-30–FR-32): сколько заплачу / получу по курсу этого обменника.

import type { ApiRate, Mode } from './rates.js';

/** foreign — ввожу сумму в иностранной валюте; local — в местной (PLN/BYN), FR-31. */
export type Direction = 'foreign' | 'local';

/**
 * «Покупаю»: обменник продаёт мне валюту по своему курсу продажи (sell); «Продаю» — покупает по buy (FR-12).
 * foreign: сумма в валюте → сколько местной; local: сумма в местной → сколько валюты.
 */
export function calculate(amount: number, rate: ApiRate, mode: Mode, direction: Direction): { result: number; side: 'buy' | 'sell' } | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const side = mode === 'buy' ? 'sell' : 'buy';
  const price = rate[side];
  if (!price) return null;
  const result = direction === 'foreign' ? amount * price : amount / price;
  return { result: Math.round(result * 100) / 100, side };
}

/** Разбор суммы, как её вводят на телефоне: «1 500,50» → 1500.5. */
export function parseAmount(text: string): number {
  return Number.parseFloat(text.replace(/\s/g, '').replace(',', '.'));
}
