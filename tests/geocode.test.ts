import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeGugik, geocodeGugikLoose, geocodeNominatim, parsePolishAddress, placeNamesFromAddress } from '../lib/geocode.js';

afterEach(() => vi.unstubAllGlobals());

describe('parsePolishAddress', () => {
  it('улица, номер, индекс и город', () => {
    expect(parsePolishAddress('Głębocka 15, 03-287 Warszawa')).toEqual({
      street: 'Głębocka',
      number: '15',
      postalCode: '03-287',
      city: 'Warszawa',
    });
  });

  it('убирает пояснения в скобках, в том числе вложенные', () => {
    expect(parsePolishAddress('Targowa 46 (lok. 65), 03-733 Warszawa')).toMatchObject({ street: 'Targowa', number: '46' });
    expect(
      parsePolishAddress('Al. Jana Pawła II 46/48 paw. 12 (róg. Al. Solidarności (obok)), 00-148 Warszawa'),
    ).toMatchObject({ street: 'Aleje Jana Pawła II', number: '46/48' });
  });

  it('раскрывает Al. и убирает ul.', () => {
    expect(parsePolishAddress('al. Jana Pawła II 82, 00-175 Warszawa')).toMatchObject({
      street: 'aleje Jana Pawła II',
      number: '82',
    });
    expect(parsePolishAddress('ul. Złota 65, 00-819 Warszawa')).toMatchObject({ street: 'Złota', number: '65' });
  });

  it('номер с буквой и улица из нескольких слов с цифрами', () => {
    expect(parsePolishAddress('Marszałkowska 99A (Hotel Metropol), 00-693 Warszawa')).toMatchObject({ number: '99A' });
    expect(parsePolishAddress('Zgrupowania AK Kampinos 15 (Młociny2 poz-0), 01-943 Warszawa')).toMatchObject({
      street: 'Zgrupowania AK Kampinos',
      number: '15',
    });
  });

  it('без номера дома — null: середина улицы не годится для карты', () => {
    expect(parsePolishAddress('Jana Pawła II, 00-141 Warszawa')).toBeNull();
    expect(parsePolishAddress('Metro Centrum (Przejście podziemne (Rondo Dmowskiego), Lokal 33), 00-026 Warszawa')).toBeNull();
  });
});

const address = { street: 'Złota', number: '65', postalCode: '00-819', city: 'Warszawa' };

describe('geocodeGugik', () => {
  it('берёт точку из ответа: x — долгота, y — широта', async () => {
    const fetchSpy = vi.fn(async (_url: string) =>
      Response.json({
        'returned objects': 1,
        results: {
          '1': { city: 'Warszawa', code: '04-999', number: '65', x: '21.2', y: '52.25' },
          '2': { city: 'Warszawa', code: '00-819', number: '65', x: '20.9982021096456', y: '52.2298599936071' },
        },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    expect(await geocodeGugik(address)).toEqual({ lat: 52.2298599936071, lng: 20.9982021096456 });
    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.searchParams.get('address')).toBe('00-819 Warszawa, Złota 65');
    expect(url.searchParams.get('srid')).toBe('4326');
  });

  it('одноимённая улица в другом районе (другой индекс) — null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ results: { '1': { city: 'Warszawa', code: '04-999', x: '21.2', y: '52.25' } } })),
    );
    expect(await geocodeGugik(address)).toBeNull();
  });

  it('пустой результат — null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ 'returned objects': 0, results: null })));
    expect(await geocodeGugik(address)).toBeNull();
  });

  it('точка из другого города — null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ results: { '1': { city: 'Kraków', code: '00-819', x: '19.9', y: '50.0' } } })),
    );
    expect(await geocodeGugik(address)).toBeNull();
  });
});

describe('адрес без индекса (marketportal)', () => {
  it('разбирается с пустым индексом', () => {
    expect(parsePolishAddress('Al. Komisji Edukacji Narodowej 36, Warszawa')).toEqual({
      street: 'Aleje Komisji Edukacji Narodowej',
      number: '36',
      postalCode: '',
      city: 'Warszawa',
    });
  });

  it('GUGiK без индекса: только если адрес в городе один', async () => {
    const a = { street: 'Tamka', number: '45a', postalCode: '', city: 'Warszawa' };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ results: { '1': { city: 'Warszawa', code: '00-369', x: '21.02182', y: '52.23645' } } })));
    expect(await geocodeGugikLoose(a)).toEqual({ lat: 52.23645, lng: 21.02182 });
    expect(await geocodeGugik(a)).toBeNull(); // точный поиск без индекса не делаем
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ results: { '1': { city: 'Warszawa', code: '00-369', x: '21', y: '52.2' }, '2': { city: 'Warszawa', code: '05-077', x: '21.2', y: '52.2' } } }),
      ),
    );
    expect(await geocodeGugikLoose(a)).toBeNull();
  });
});

describe('geocodeGugikLoose', () => {
  const jp2 = { street: 'Jana Pawła II', number: '29', postalCode: '00-566', city: 'Warszawa' };
  const both = {
    results: {
      '1': { city: 'Warszawa', code: '05-077', x: '21.2424997427874', y: '52.218018872925' },
      '2': { city: 'Warszawa', code: '00-867', x: '20.9953281939636', y: '52.2390191363433' },
    },
  };

  it('неточный индекс: без индекса, единственный адрес с тем же началом индекса', async () => {
    const fetchSpy = vi.fn(async (_url: string) => Response.json(both));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await geocodeGugikLoose(jp2)).toEqual({ lat: 52.2390191363433, lng: 20.9953281939636 });
    expect(new URL(fetchSpy.mock.calls[0]![0] as string).searchParams.get('address')).toBe('Warszawa, Jana Pawła II 29');
  });

  it('два адреса с тем же началом индекса — не угадываем', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ results: { ...both.results, '3': { city: 'Warszawa', code: '00-999', x: '21', y: '52.2' } } })));
    expect(await geocodeGugikLoose(jp2)).toBeNull();
  });

  it('ответ «Blad zapytania.» — не найдено', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Blad zapytania.')));
    expect(await geocodeGugikLoose(jp2)).toBeNull();
    expect(await geocodeGugik(jp2)).toBeNull();
  });
});

describe('geocodeNominatim', () => {
  it('структурированный запрос по Польше, первая точка', async () => {
    const fetchSpy = vi.fn(async (_url: string) => Response.json([{ lat: '52.2299', lon: '20.9981', addresstype: 'building' }]));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await geocodeNominatim(address)).toEqual({ lat: 52.2299, lng: 20.9981 });
    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.searchParams.get('street')).toBe('65 Złota');
    expect(url.searchParams.get('countrycodes')).toBe('pl');
    expect(url.searchParams.get('postalcode')).toBe('00-819');
  });

  it('ничего не нашёл — null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([])));
    expect(await geocodeNominatim(address)).toBeNull();
  });
});

describe('placeNamesFromAddress', () => {
  it('названия ТЦ и магазинов из кавычек и скобок', () => {
    expect(placeNamesFromAddress('Минский район, Боровлянский с/с, 74/1 (ТЦ «Экспобел»)')).toEqual(['Экспобел']);
    expect(placeNamesFromAddress('Минская обл., Минский р-н, Боровлянский с/с, 7А, "ГИППО", Боровая')).toEqual(['ГИППО']);
    expect(placeNamesFromAddress('Минский район, район аг. Сеница, 68/3, строительный супермаркет «Мастак», Минск')).toEqual(['Мастак']);
    expect(placeNamesFromAddress('ул. Ольшевского, 1/3, Минск')).toEqual([]);
    expect(placeNamesFromAddress('пр. газеты "Звезда", 16, Минск')).toEqual([]);
  });
});
