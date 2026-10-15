// Таблицы из SPEC.md, раздел «Модель данных и API».

import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/** Часы работы по дням: ["10:00","18:00"] или null — выходной. Нет ключа — часы неизвестны (FR-22). */
export type WeekHours = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string] | null>>;

export const exchangers = pgTable(
  'exchangers',
  {
    id: text('id').primaryKey(), // pl-waw-kantorlive-578636
    country: text('country', { enum: ['PL', 'BY'] }).notNull(),
    city: text('city').notNull(),
    name: text('name').notNull(),
    bank: text('bank'), // только для BY
    address: text('address').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    // address — координаты источника были далеко от адреса и заменены точкой адреса (check-coords).
    coordsSource: text('coords_source', { enum: ['source', 'osm', 'geocoder', 'address'] }),
    /** Когда координаты источника сверены с адресом; при смене адреса сбрасывается. */
    coordsCheckedAt: timestamp('coords_checked_at', { withTimezone: true }),
    hours: jsonb('hours').$type<WeekHours>(),
    sourceIds: jsonb('source_ids').$type<Record<string, string>>().notNull().default({}),
    phone: text('phone'),
    website: text('website'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('exchangers_lat_lng_idx').on(t.lat, t.lng), index('exchangers_city_idx').on(t.country, t.city)],
);

export const rates = pgTable(
  'rates',
  {
    exchangerId: text('exchanger_id')
      .notNull()
      .references(() => exchangers.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull(), // ISO-код
    buy: doublePrecision('buy'), // обменник покупает; null — этой стороны нет (правило склейки 4)
    sell: doublePrecision('sell'), // обменник продаёт
    rateUpdatedAt: timestamp('rate_updated_at', { withTimezone: true }), // время курса из источника
    source: text('source').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(), // значение впервые забрали
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(), // правило склейки 6
  },
  (t) => [primaryKey({ columns: [t.exchangerId, t.currency, t.source] })],
);

export const cityFetches = pgTable(
  'city_fetches',
  {
    source: text('source').notNull(),
    country: text('country', { enum: ['PL', 'BY'] }).notNull(),
    city: text('city').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }), // последний успешный сбор
    status: text('status', { enum: ['ok', 'error', 'running'] }).notNull(),
    error: text('error'),
    /** Начало текущего сбора: защита от второго параллельного сбора того же города. */
    startedAt: timestamp('started_at', { withTimezone: true }).default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.source, t.country, t.city] })],
);

/**
 * Золото (решение 15.10.2026). Владелец — обменник (kantor: цена за 1 г по пробе) или банк Беларуси целиком
 * (`bank:<название>`: цена мерного слитка по весу; в каких отделениях слитки есть — источник не говорит).
 */
export const goldPrices = pgTable(
  'gold_prices',
  {
    source: text('source').notNull(),
    country: text('country', { enum: ['PL', 'BY'] }).notNull(),
    owner: text('owner').notNull(), // id обменника или «bank:беларусбанк»
    kind: text('kind', { enum: ['purity', 'bar'] }).notNull(), // purity — за 1 г пробы; bar — за слиток
    item: text('item').notNull(), // «999», «585» или вес в граммах «10»
    buy: doublePrecision('buy'), // обменник/банк покупает
    sell: doublePrecision('sell'), // обменник/банк продаёт
    priceUpdatedAt: timestamp('price_updated_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.source, t.owner, t.kind, t.item] })],
);

/**
 * Населённые пункты и районы городов Польши и Беларуси из GeoNames (CC BY 4.0) — быстрые подсказки поиска
 * (решение 15.10.2026: публичный Photon отвечал по 8–10 с). `search` — «|вариант|вариант|» в нижнем регистре
 * без диакритики, для поиска по началу любого варианта названия (русского, белорусского, польского, латиницей).
 */
export const places = pgTable(
  'places',
  {
    id: integer('id').primaryKey(), // geonameid
    country: text('country', { enum: ['PL', 'BY'] }).notNull(),
    name: text('name').notNull(),
    names: jsonb('names').$type<string[]>().notNull(),
    search: text('search').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    population: integer('population').notNull().default(0),
    kind: text('kind').notNull(), // код GeoNames: PPLC, PPLA, PPL, PPLX (район города)…
  },
  (t) => [index('places_country_idx').on(t.country)],
);
