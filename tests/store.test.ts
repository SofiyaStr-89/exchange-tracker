import { describe, expect, it } from 'vitest';
import { withExistingExchangers } from '../lib/store.js';

/** Подмена базы: select().from().where() отдаёт обменники, которые «есть». */
const fakeDb = (existing: string[]) =>
  ({
    select: () => ({ from: () => ({ where: async () => existing.map((id) => ({ id })) }) }),
  }) as unknown as Parameters<typeof withExistingExchangers>[0];

describe('запись курсов', () => {
  it('курс удалённого обменника пропускается, остальные записываются', async () => {
    const list = [
      { exchangerId: 'pl-warszawa-site-1', currency: 'USD' },
      { exchangerId: 'pl-warszawa-marketportal-55', currency: 'USD' },
      { exchangerId: 'pl-warszawa-site-1', currency: 'EUR' },
    ];
    const kept = await withExistingExchangers(fakeDb(['pl-warszawa-site-1']), list);
    expect(kept.map((r) => `${r.exchangerId}|${r.currency}`)).toEqual(['pl-warszawa-site-1|USD', 'pl-warszawa-site-1|EUR']);
  });
});
