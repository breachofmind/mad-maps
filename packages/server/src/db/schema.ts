import { pgTable, pgEnum, uuid, text, timestamp, doublePrecision, jsonb, integer, boolean, customType } from 'drizzle-orm/pg-core';
import type { PmtilesMetadata } from '@mad-maps/shared';

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

export interface LayerColorStop {
  value: number;
  color: string;
}

export interface LayerIconRule {
  value: string;
  // Either an image URL or a namespaced Maki icon name (e.g. "maki:restaurant").
  iconUrl: string;
}

export interface LayerStyleConfig {
  labelProperty: string | null;
  colorProperty: string | null;
  colorStops: LayerColorStop[];
  iconProperty: string | null;
  // Icon-by-value rules, keyed by property name — see the identical field on
  // @mad-maps/shared's LayerStyleConfig (this type is duplicated here for
  // the Drizzle column annotation, kept in sync manually).
  iconRulesByProperty: Record<string, LayerIconRule[]>;
  // Image URL or "maki:"-prefixed icon name — see LayerIconRule.iconUrl.
  defaultIconUrl: string | null;
}

export const layerSourceTypeEnum = pgEnum('layer_source_type', ['local', 'geojson-url', 'pmtiles-url']);

export const layers = pgTable('layers', {
  id: uuid('id').primaryKey().defaultRandom(),
  mapId: uuid('map_id')
    .notNull()
    .references(() => maps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
  color: text('color').notNull().default('#1976d2'),
  // Icon applied to brand-new local features added to this layer — see
  // LayerStyleConfig.defaultIconUrl for the remote-layer counterpart.
  defaultIcon: text('default_icon').notNull().default('marker'),
  sourceType: layerSourceTypeEnum('source_type').notNull().default('local'),
  sourceUrl: text('source_url'),
  // Only set for sourceType 'pmtiles-url': the vector-tile source-layer name
  // this Mad Maps layer renders. A PMTiles archive with multiple named
  // layers is added multiple times, once per source-layer.
  sourceLayer: text('source_layer'),
  // Only set for sourceType 'pmtiles-url': captured once at add-time from
  // the archive's header/metadata (field names+types, zoom, bounds) so the
  // client never has to re-fetch the archive to know what properties exist.
  pmtilesMetadata: jsonb('pmtiles_metadata').$type<PmtilesMetadata>(),
  styleConfig: jsonb('style_config').$type<LayerStyleConfig>(),
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
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
}

export const mapFeatures = pgTable('map_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  layerId: uuid('layer_id')
    .notNull()
    .references(() => layers.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull().default(0),
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
