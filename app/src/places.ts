// Обменники в одном месте (торговый центр, вокзал): на любом масштабе — одна плашка с числом пунктов,
// нажатие — список пунктов. Иначе плашки с одинаковыми координатами ложатся друг на друга (Брест, ТЦ «Корона»).

import { distanceMeters } from '../../lib/geo.js';

/** Ближе этого — одно место: источники ставят все пункты торгового центра в одну точку или рядом. */
export const SAME_PLACE_M = 25;

export function groupByPlace<T extends { lat: number; lng: number }>(items: T[], radiusM = SAME_PLACE_M): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const group = groups.find((g) => distanceMeters(g[0]!, item) <= radiusM);
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups;
}
