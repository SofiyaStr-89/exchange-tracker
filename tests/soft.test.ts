import { describe, expect, it } from 'vitest';
import { serviceErrors, soft } from '../lib/soft.js';

describe('сбой сервиса адресов не роняет шаг', () => {
  it('ошибка → запасное значение и запись; успех — как есть', async () => {
    const failing = soft(async (_q: string): Promise<number | null> => {
      throw new Error('Nominatim: HTTP 629');
    }, null);
    const working = soft(async (q: string) => q.length, null);
    expect(await failing('Советская 82/1, Барановичи')).toBeNull();
    expect(await working('abc')).toBe(3);
    expect(serviceErrors).toContain('Nominatim: HTTP 629');
  });
});
