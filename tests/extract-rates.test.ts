import { describe, expect, it } from 'vitest';
import { extractRates, extractTimestamp, sanitizeRate } from '../lib/extract-rates.js';

const nbp = { USD: 3.92, EUR: 4.39, GBP: 5.18, CHF: 4.71, HUF: 0.012, JPY: 0.0247 };
const now = new Date('2026-10-12T15:00:00Z');

describe('extractRates: таблица курсов с любой страницы', () => {
  it('код валюты и два числа рядом: покупка, продажа', () => {
    const html = `<table><tr><th>Waluta</th><th>Kupno</th><th>Sprzedaż</th></tr>
      <tr><td><img alt=""> USD</td><td>3,8700</td><td>3,9700</td></tr>
      <tr><td>EUR - euro</td><td>4.35</td><td>4.44</td></tr></table>`;
    expect(extractRates(html, nbp)).toEqual({ USD: { buy: 3.87, sell: 3.97 }, EUR: { buy: 4.35, sell: 4.44 } });
  });

  it('числа в одной строке с кодом и «zł»', () => {
    expect(extractRates('<p>GBP 5,12 zł 5,24 zł</p>', nbp)).toEqual({ GBP: { buy: 5.12, sell: 5.24 } });
  });

  it('курс за 100 единиц приводится к 1 по справочнику NBP', () => {
    expect(extractRates('<tr><td>100 HUF</td><td>1,1600</td><td>1,2800</td></tr>', nbp)).toEqual({ HUF: { buy: 0.0116, sell: 0.0128 } });
  });

  it('колонки в обратном порядке (sprzedaż, kupno) — меняются местами', () => {
    expect(extractRates('<tr><td>CHF</td><td>4,77</td><td>4,65</td></tr>', nbp)).toEqual({ CHF: { buy: 4.65, sell: 4.77 } });
  });

  it('неправдоподобные числа (монеты, телефоны, проценты) отбрасываются (правило склейки 7)', () => {
    const html = `<p>USD 2,50 3,00</p><p>EUR tel. 22 123</p><p>GBP 3,50 4,20</p>`;
    expect(extractRates(html, nbp)).toEqual({});
  });

  it('для валюты берётся первая правдоподобная строка', () => {
    const html = `<tr><td>USD</td><td>3,30</td><td>0,00</td></tr><tr><td>USD</td><td>3,88</td><td>3,95</td></tr><tr><td>USD</td><td>3,90</td><td>3,99</td></tr>`;
    expect(extractRates(html, nbp).USD).toEqual({ buy: 3.88, sell: 3.95 });
  });

  it('одна сторона нулевая — только другая', () => {
    expect(extractRates('<tr><td>JPY</td><td>0,0247</td><td>0,0000</td></tr>', nbp)).toEqual({ JPY: { buy: 0.0247, sell: null } });
  });

  it('скрипты и стили не читаются; валюты нет в NBP — пропуск', () => {
    expect(extractRates('<script>var USD = [3.9, 3.95]</script><tr><td>XYZ</td><td>3,9</td><td>4,0</td></tr>', nbp)).toEqual({});
  });
});

describe('extractRates: разделы, варианты и соседние строки (реальные примеры)', () => {
  it('розничный раздел главнее оптового, даже если опт выше на странице', () => {
    const html = `<h3>Ceny hurtowe</h3><p>Waluta Kupujemy Sprzedajemy</p><p>EUR - euro 4,38 4,399</p><p>USD - dolar 3,906 3,929</p>
      <h3>Ceny detaliczne</h3><p>EUR - euro 4,335 4,43</p><p>USD - dolar amerykański 3,845 3,945</p>`;
    expect(extractRates(html, nbp)).toEqual({ EUR: { buy: 4.335, sell: 4.43 }, USD: { buy: 3.845, sell: 3.945 } });
  });

  it('только оптовый раздел — берётся опт', () => {
    expect(extractRates('<h3>kursy hurtowe</h3><p>1 USD 3.910 3.940</p>', nbp)).toEqual({ USD: { buy: 3.91, sell: 3.94 } });
  });

  it('варианты валюты (старые доллары, монеты, мелкие купюры) пропускаются', () => {
    const html = `<p>Dolar USA - do 2007 r 1 USD 3.500 3.920</p><p>Dolar USA - NOWY 1 USD 3.870 3.970</p>
      <h3>Bilon</h3><p>Waluta Kupno Sprzedaż</p><p>Euro (EUR) 3.00 4.30</p>`;
    expect(extractRates(html, nbp)).toEqual({ USD: { buy: 3.87, sell: 3.97 } });
  });

  it('«(EUR)» в скобках — начало следующей строки; «3.9050(nowy)» — число', () => {
    const html = '<p>Dolar amerykański (USD) 3.9050(nowy] 3.9250(nowy) Euro (EUR) 4.3750 4.3950</p>';
    expect(extractRates(html, nbp)).toEqual({ USD: { buy: 3.905, sell: 3.925 }, EUR: { buy: 4.375, sell: 4.395 } });
  });

  it('основные валюты: продажа ниже NBP−3% или покупка равна продаже — не курс', () => {
    expect(extractRates('<p>Dolar USA USD 3.653 3.715</p>', nbp)).toEqual({});
    expect(extractRates('<p>USD 3,8500 3,8500</p>', nbp)).toEqual({});
  });

  it('у экзотических валют спред бывает большим — допуск шире', () => {
    expect(extractRates('<p>TRY 0,075 0,114</p>', { TRY: 0.092 })).toEqual({ TRY: { buy: 0.075, sell: 0.114 } });
  });
});

describe('extractTimestamp: время обновления курсов на странице', () => {
  it.each([
    ['Aktualizacja: 12.10.2026 16:40', '2026-10-12T14:40:00Z'],
    ['Dane kursów z: 2026-10-12 16:34', '2026-10-12T14:34:00Z'],
    ['Ostatnia aktualizacja 12-10-2026, 11:31', '2026-10-12T09:31:00Z'],
    ['aktualizacja kursów: 12.10.26 16:41', '2026-10-12T14:41:00Z'],
    ['Kursy z dnia 12.10.2026', '2026-10-11T22:00:00Z'],
  ])('%s', (text, iso) => {
    expect(extractTimestamp(`<div>${text}</div>`, now)?.toISOString()).toBe(new Date(iso).toISOString());
  });

  it('нет времени или время из будущего — null', () => {
    expect(extractTimestamp('<p>Kantor zaprasza</p>', now)).toBeNull();
    expect(extractTimestamp('<p>Aktualizacja: 14.10.2026 10:00</p>', now)).toBeNull();
  });
});

describe('sanitizeRate: сверка с NBP для любого источника (правило склейки 7)', () => {
  it('правдоподобный курс — как есть', () => {
    expect(sanitizeRate('USD', 3.88, 3.95, nbp)).toEqual({ buy: 3.88, sell: 3.95 });
  });
  it('продажа ниже NBP−3% (kantor в убытке) — устаревшая таблица, курс целиком отбрасывается', () => {
    expect(sanitizeRate('USD', 3.58, 3.71, nbp)).toBeNull();
    expect(sanitizeRate('USD', 3.85, 3.71, nbp)).toBeNull();
  });
  it('грабительский, но реальный курс (аэропорт, +10%) — остаётся', () => {
    expect(sanitizeRate('GBP', 5.0386, 5.7139, nbp)).toEqual({ buy: 5.0386, sell: 5.7139 });
  });
  it('покупка выше NBP+3% невозможна — курс целиком отбрасывается', () => {
    expect(sanitizeRate('EUR', 4.6, 4.7, nbp)).toBeNull();
  });
  it('мусор (в 2 раза дороже) — отбрасывается', () => {
    expect(sanitizeRate('EUR', 4.35, 9.0, nbp)).toEqual({ buy: 4.35, sell: null });
  });
  it('валюты нет в справочнике — проверить нечем, оставляем', () => {
    expect(sanitizeRate('XAU', 400, 420, nbp)).toEqual({ buy: 400, sell: 420 });
  });
});
