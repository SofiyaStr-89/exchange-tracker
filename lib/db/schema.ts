// Таблицы из SPEC.md, раздел «Модель данных и API».

import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
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
    coordsSource: text('coords_source', { enum: ['source', 'osm', 'geocoder'] }),
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
