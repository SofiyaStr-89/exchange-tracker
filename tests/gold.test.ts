import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseKursarzGold } from '../lib/adapters/kursarz-gold.js';
import { parseMyfinGold } from '../lib/adapters/myfin-gold.js';
import { bankKey, goldOwners, sanitizeGold } from '../lib/gold.js';

const kursarz = parseKursarzGold(readFileSync('tests/fixtures/kursarz-gold-sample.html', 'utf8'), 'Warszawa', 'pl-warszawa');
const myfin = parseMyfinGold(readFileSync('tests/fixtures/myfin-gold-sample.html', 'utf8'), new Date('2026-10-15T08:00:00Z'));

describe('золото kursarz', () => {
  it('kantor, проба, цена за 1 г и время; другой город по подстроке отброшен', () => {
    expect(kursarz.length).toBeGreaterThan(0);
    expect(kursarz.every((g) => g.owner.startsWith('pl-warszawa-kursarz-') && g.kind === 'purity')).toBe(true);
    expect(kursarz.filter((g) => g.owner === 'pl-warszawa-kursarz-632' && g.item === '999')).toEqual([
      expect.objectContaining({ buy: 500, sell: 535, priceUpdatedAt: new Date('2026-10-15T07:00:00Z'), source: 'kursarz-gold' }),
    ]);
  });
});

describe('слитки myfin', () => {
  it('только раздел «Слитки», без металлических счетов и Нацбанка', () => {
    const banks = [...new Set(myfin.map((g) => g.owner))];
    expect(banks).toContain('bank:беларусбанк');
    expect(banks).not.toContain('bank:банк белвэб');
    expect(banks.some((b) => b.includes('национальный'))).toBe(false);
  });

  it('пары «банк покупает / банк продаёт» по весу', () => {
    const bb = myfin.filter((g) => g.owner === 'bank:беларусбанк');
    expect(bb.find((g) => g.item === '10')).toMatchObject({ kind: 'bar', buy: 4350, sell: 4500 });
    expect(bb.find((g) => g.item === '1')).toMatchObject({ buy: null, sell: 500 });
  });
});

describe('проверка цен золота', () => {
  const g = (item: string, buy: number | null, sell: number | null) => ({
    country: 'PL' as const, owner: 'x', kind: 'purity' as const, item, buy, sell, priceUpdatedAt: null, source: 's',
  });

  it('продажа сильно ниже рынка отбрасывается, скупка ниже рынка остаётся', () => {
    // NBP 520 zł/г → проба 585 ≈ 304 zł
    expect(sanitizeGold([g('585', 120, 155)], 520)).toEqual([expect.objectContaining({ buy: 120, sell: null })]);
    expect(sanitizeGold([g('999', 500, 535)], 520)).toEqual([expect.objectContaining({ buy: 500, sell: 535 })]);
  });

  it('покупка дороже продажи — ошибка, не показываем', () => {
    expect(sanitizeGold([{ ...g('10', 4500, 4350), kind: 'bar' }], null)).toEqual([]);
  });

  it('ключ банка и владельцы золота обменника', () => {
    expect(bankKey('МТБанк')).toBe(bankKey('МТбанк'));
    expect(goldOwners({ id: 'a', country: 'BY', bank: 'Беларусбанк', memberIds: ['a', 'b'] })).toEqual(['a', 'b', 'bank:беларусбанк']);
    expect(goldOwners({ id: 'k', country: 'PL', bank: null })).toEqual(['k']);
  });
});
