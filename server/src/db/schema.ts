import { pgTable, uuid, text, timestamp, doublePrecision, jsonb, integer, boolean, customType } from 'drizzle-orm/pg-core';

// Drizzle's built-in pg-core `geometry()` column only supports Point geometry
// (its mapToDriverValue always emits `point(...)`), which doesn't fit a
// column that stores mixed Point/LineString/Polygon geometry. We store the
// raw EWKB text form here and always read/write through explicit
// ST_GeomFromGeoJSON / ST_AsGeoJSON SQL fragments in features.service.ts
// instead of relying on Drizzle's value mapping for this column.
const geometryPostGIS = customType<{ data: string }>({
  dataType() {
    return 'geometry(Geometry, 4326)';
  },
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export interface LngLat {
  lng: number;
  lat: number;
}

export const maps = pgTable('maps', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  baseStyle: text('base_style').notNull().default('mapbox://styles/mapbox/streets-v12'),
  defaultCenter: jsonb('default_center').$type<LngLat>().notNull().default({ lng: -98.5795, lat: 39.8283 }),
  defaultZoom: doublePrecision('default_zoom').notNull().default(3.5),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Map = typeof maps.$inferSelect;
export type NewMap = typeof maps.$inferInsert;

export const layers = pgTable('layers', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id')
    .notNull()
    .references(() => maps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
  color: text('color').notNull().default('#1976d2'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Layer = typeof layers.$inferSelect;
export type NewLayer = typeof layers.$inferInsert;

export interface MapFeatureProperties {
  title: string;
  descriptionHtml: string;
  icon: string;
  color: string;
  strokeWidth?: number;
}

export const mapFeatures = pgTable('map_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  layerId: uuid('layer_id')
    .notNull()
    .references(() => layers.id, { onDelete: 'cascade' }),
  featureType: text('feature_type').notNull(),
  geometry: geometryPostGIS('geometry').notNull(),
  properties: jsonb('properties').$type<MapFeatureProperties>().notNull().default({
    title: '',
    descriptionHtml: '',
    icon: 'marker',
    color: '#1976d2',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MapFeatureRow = typeof mapFeatures.$inferSelect;
export type NewMapFeatureRow = typeof mapFeatures.$inferInsert;
