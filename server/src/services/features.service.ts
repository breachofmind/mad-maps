import { and, eq, sql } from 'drizzle-orm';
import type { MapFeatureDTO } from '@mapinski/shared';
import { geometryToFeatureType, type Geometry } from '@mapinski/shared';
import { db } from '../db/client';
import { layers, maps, mapFeatures, type MapFeatureProperties } from '../db/schema';
import { findLayerForOwner } from './layers.service';
import { sanitizeHtml } from '../lib/sanitizeHtml';

// Defense in depth: the client sanitizes with DOMPurify before sending, but
// descriptionHtml is re-sanitized here too so storage is never trusted to
// have gone through the client's sanitizer.
function sanitizeProperties<T extends { descriptionHtml?: string }>(properties: T): T {
  if (properties.descriptionHtml === undefined) return properties;
  return { ...properties, descriptionHtml: sanitizeHtml(properties.descriptionHtml) };
}

interface FeatureRow {
  id: string;
  layerId: string;
  featureType: string;
  geometry: string;
  properties: MapFeatureProperties;
  createdAt: Date;
  updatedAt: Date;
}

const selectShape = {
  id: mapFeatures.id,
  layerId: mapFeatures.layerId,
  featureType: mapFeatures.featureType,
  geometry: sql<string>`ST_AsGeoJSON(${mapFeatures.geometry})`,
  properties: mapFeatures.properties,
  createdAt: mapFeatures.createdAt,
  updatedAt: mapFeatures.updatedAt,
};

function geometryToSql(geometry: Geometry) {
  return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326)`;
}

export interface CreateFeatureInput {
  geometry: Geometry;
  properties: MapFeatureProperties;
}

export interface UpdateFeatureInput {
  geometry?: Geometry;
  properties?: Partial<MapFeatureProperties>;
}

export async function listFeaturesForLayer(layerId: string, ownerId: string): Promise<FeatureRow[] | null> {
  const layer = await findLayerForOwner(layerId, ownerId);
  if (!layer) return null;
  return db.select(selectShape).from(mapFeatures).where(eq(mapFeatures.layerId, layerId));
}

export async function createFeature(
  layerId: string,
  ownerId: string,
  input: CreateFeatureInput,
): Promise<FeatureRow | null> {
  const layer = await findLayerForOwner(layerId, ownerId);
  if (!layer) return null;

  const [created] = await db
    .insert(mapFeatures)
    .values({
      layerId,
      featureType: geometryToFeatureType(input.geometry),
      geometry: geometryToSql(input.geometry),
      properties: sanitizeProperties(input.properties),
    })
    .returning(selectShape);
  return created;
}

export async function findFeatureForOwner(featureId: string, ownerId: string): Promise<FeatureRow | null> {
  const [row] = await db
    .select(selectShape)
    .from(mapFeatures)
    .innerJoin(layers, eq(mapFeatures.layerId, layers.id))
    .innerJoin(maps, eq(layers.mapId, maps.id))
    .where(and(eq(mapFeatures.id, featureId), eq(maps.ownerId, ownerId)));
  return row ?? null;
}

export async function updateFeatureForOwner(
  featureId: string,
  ownerId: string,
  input: UpdateFeatureInput,
): Promise<FeatureRow | null> {
  const existing = await findFeatureForOwner(featureId, ownerId);
  if (!existing) return null;

  const nextProperties = input.properties
    ? sanitizeProperties({ ...existing.properties, ...input.properties })
    : undefined;

  const [updated] = await db
    .update(mapFeatures)
    .set({
      ...(input.geometry
        ? { geometry: geometryToSql(input.geometry), featureType: geometryToFeatureType(input.geometry) }
        : {}),
      ...(nextProperties ? { properties: nextProperties } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mapFeatures.id, featureId))
    .returning(selectShape);
  return updated;
}

export async function deleteFeatureForOwner(featureId: string, ownerId: string): Promise<boolean> {
  const existing = await findFeatureForOwner(featureId, ownerId);
  if (!existing) return false;

  await db.delete(mapFeatures).where(eq(mapFeatures.id, featureId));
  return true;
}

export function toMapFeatureDTO(row: FeatureRow): MapFeatureDTO {
  return {
    id: row.id,
    layerId: row.layerId,
    featureType: row.featureType as MapFeatureDTO['featureType'],
    geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
    properties: row.properties,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
