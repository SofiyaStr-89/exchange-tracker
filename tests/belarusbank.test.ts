import { describe, expect, it } from 'vitest';
import { parseBelarusbank } from '../lib/adapters/belarusbank.js';
import { parseNbrbRates } from '../lib/nbrb.js';

const nbrb = parseNbrbRates([
  { Cur_Abbreviation: 'USD', Cur_Scale: 1, Cur_OfficialRate: 3.0392 },
  { Cur_Abbreviation: 'RUB', Cur_Scale: 100, Cur_OfficialRate: 3.5899 },
  { Cur_Abbreviation: 'PLN', Cur_Scale: 10, Cur_OfficialRate: 7.7901 },
]);

const kurs: Record<string, string>[] = [
  {
    kurs_date_time: '2026-10-07 17:20:00',
    USD_in: '3.0350', USD_out: '3.0800',
    RUB_in: '3.1500', RUB_out: '3.5900',
    PLN_in: '0.0000', PLN_out: '0.0000',
    USD_EUR_in: '0.885', USD_EUR_out: '1.102',
    filial_id: '190772',
    filials_text: 'Отделение №510/174',
    info_worktime: '|Пн 10 00 19 00    |Вт 10 00 19 00    |Ср 10 00 19 00    |Чт 10 00 19 00    |Пт 10 00 19 00    |Сб      |Вс      |',
    street_type: 'ул. ', street: 'Ольшевского', home_number: '1/3', name: 'Минск', name_type: 'г.',
  },
  {
    kurs_date_time: '2026-10-07 17:20:00',
    USD_in: '3.0300', USD_out: '3.0900',
    filial_id: '999999', filials_text: 'Отделение №700/1', info_worktime: '',
    street_type: 'пр-т ', street: 'Независимости', home_number: '1', name: 'Минск', name_type: 'г.',
  },
];
const filials = [{ filial_id: '190772', GPS_X: '53.927417', GPS_Y: '27.481600' }];

describe('parseNbrbRates', () => {
  it('курс за 1 единицу и официальный масштаб', () => {
    expect(nbrb.mids).toMatchObject({ USD: 3.0392, RUB: 0.035899, PLN: 0.77901 });
    expect(nbrb.scales).toMatchObject({ USD: 1, RUB: 100, PLN: 10 });
  });
});

describe('parseBelarusbank', () => {
  const result = parseBelarusbank(kurs, filials, nbrb.scales, 'minsk');
  const ex = Object.fromEntries(result.exchangers.map((e) => [e.id, e]));

  it('отделение: банк, название, адрес, координаты GPS_X — широта, GPS_Y — долгота', () => {
    expect(ex['by-minsk-belarusbank-190772']).toMatchObject({
      country: 'BY',
      city: 'Минск',
      bank: 'Беларусбанк',
      name: 'Отделение №510/174',
      address: 'ул. Ольшевского, 1/3, Минск',
      lat: 53.927417,
      lng: 27.4816,
      coordsSource: 'source',
      sourceIds: { belarusbank: '190772' },
    });
  });

  it('часы из info_worktime; выходные — null; пусто — часы неизвестны', () => {
    expect(ex['by-minsk-belarusbank-190772']!.hours).toEqual({
      mon: ['10:00', '19:00'], tue: ['10:00', '19:00'], wed: ['10:00', '19:00'], thu: ['10:00', '19:00'], fri: ['10:00', '19:00'], sat: null, sun: null,
    });
    expect(ex['by-minsk-belarusbank-999999']!.hours).toBeNull();
  });

  it('без координат в filials_info — null (найдёт геокодер или другой источник)', () => {
    expect(ex['by-minsk-belarusbank-999999']).toMatchObject({ lat: null, coordsSource: null });
  });

  it('курсы приводятся к 1 единице по масштабу НБРБ; 0 — валюты нет; кросс-курсы пропускаются', () => {
    const rates = result.rates.filter((r) => r.exchangerId === 'by-minsk-belarusbank-190772');
    expect(rates.map((r) => r.currency).sort()).toEqual(['RUB', 'USD']);
    expect(rates.find((r) => r.currency === 'RUB')).toMatchObject({ buy: 0.0315, sell: 0.0359 });
    expect(rates.find((r) => r.currency === 'USD')).toMatchObject({
      buy: 3.035,
      sell: 3.08,
      rateUpdatedAt: new Date('2026-10-07T14:20:00Z'),
      source: 'belarusbank',
    });
  });
});
