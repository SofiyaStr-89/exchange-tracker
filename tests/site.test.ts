import { describe, expect, it } from 'vitest';
import { robotsAllows } from '../lib/adapters/site.js';

describe('robotsAllows', () => {
  it('Disallow для всех — нельзя; Allow точнее — можно', () => {
    const txt = 'User-agent: *\nDisallow: /\nAllow: /kursy\n';
    expect(robotsAllows(txt, '/')).toBe(false);
    expect(robotsAllows(txt, '/kursy-walut')).toBe(true);
  });

  it('запрет только для другого бота нас не касается; пустой Disallow — можно всё', () => {
    expect(robotsAllows('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow:\n', '/')).toBe(true);
  });

  it('запрет для нашего бота по имени', () => {
    expect(robotsAllows('User-agent: ExchangeMapBot\nDisallow: /\n', '/')).toBe(false);
  });
});
