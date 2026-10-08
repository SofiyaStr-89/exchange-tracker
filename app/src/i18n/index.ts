import { ru, type Messages } from './ru.js';

export const t: Messages = ru;

/** Подставляет значения в {имя}: fmt(t.buyLabel, { currency: 'USD' }). */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
