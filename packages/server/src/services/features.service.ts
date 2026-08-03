import { and, asc, eq, inArray, sql } from 'drizzle-orm';
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
  orderIndex: number;
  featureType: string;
  geometry: string;
  properties: MapFeatureProperties;
  createdAt: Date;
  updatedAt: Date;
}

const selectShape = {
  id: mapFeatures.id,
  layerId: mapFeatures.layerId,
  orderIndex: mapFeatures.orderIndex,
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
  return db
    .select(selectShape)
    .from(mapFeatures)
    .where(eq(mapFeatures.layerId, layerId))
    .orderBy(asc(mapFeatures.orderIndex));
}

export async function createFeature(
  layerId: string,
  ownerId: string,
  input: CreateFeatureInput,
): Promise<FeatureRow | null> {
  const layer = await findLayerForOwner(layerId, ownerId);
  if (!layer) return null;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mapFeatures)
    .where(eq(mapFeatures.layerId, layerId));

  const [created] = await db
    .insert(mapFeatures)
    .values({
      layerId,
      orderIndex: count,
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

// Moves a feature to `targetIndex` within `targetLayerId`'s ordering,
// reindexing whichever layer(s) are affected. `targetIndex` is interpreted
// against each layer's *current* order (before this feature is removed from
// it) — same-layer moves adjust for the resulting shift themselves so
// callers don't have to.
export async function moveFeatureForOwner(
  featureId: string,
  ownerId: string,
  targetLayerId: string,
  targetIndex: number,
): Promise<FeatureRow | null> {
  const existing = await findFeatureForOwner(featureId, ownerId);
  if (!existing) return null;

  const targetLayer = await findLayerForOwner(targetLayerId, ownerId);
  if (!targetLayer) return null;

  const sourceLayerId = existing.layerId;

  if (sourceLayerId === targetLayerId) {
    const siblings = await db
      .select({ id: mapFeatures.id })
      .from(mapFeatures)
      .where(eq(mapFeatures.layerId, targetLayerId))
      .orderBy(asc(mapFeatures.orderIndex));
    const currentIndex = siblings.findIndex((s) => s.id === featureId);
    const ids = siblings.map((s) => s.id).filter((id) => id !== featureId);
    let insertAt = targetIndex;
    if (currentIndex !== -1 && currentIndex < targetIndex) insertAt -= 1;
    insertAt = Math.max(0, Math.min(insertAt, ids.length));
    ids.splice(insertAt, 0, featureId);

    await Promise.all(
      ids.map((id, index) =>
        db.update(mapFeatures).set({ orderIndex: index, updatedAt: new Date() }).where(eq(mapFeatures.id, id)),
      ),
    );
  } else {
    const [sourceSiblings, targetSiblings] = await Promise.all([
      db
        .select({ id: mapFeatures.id })
        .from(mapFeatures)
        .where(eq(mapFeatures.layerId, sourceLayerId))
        .orderBy(asc(mapFeatures.orderIndex)),
      db
        .select({ id: mapFeatures.id })
        .from(mapFeatures)
        .where(eq(mapFeatures.layerId, targetLayerId))
        .orderBy(asc(mapFeatures.orderIndex)),
    ]);
    const sourceIds = sourceSiblings.map((s) => s.id).filter((id) => id !== featureId);
    const targetIds = targetSiblings.map((s) => s.id);
    const insertAt = Math.max(0, Math.min(targetIndex, targetIds.length));
    targetIds.splice(insertAt, 0, featureId);

    await Promise.all([
      ...sourceIds.map((id, index) =>
        db.update(mapFeatures).set({ orderIndex: index, updatedAt: new Date() }).where(eq(mapFeatures.id, id)),
      ),
      ...targetIds.map((id, index) =>
        db
          .update(mapFeatures)
          .set({
            orderIndex: index,
            ...(id === featureId ? { layerId: targetLayerId } : {}),
            updatedAt: new Date(),
          })
          .where(eq(mapFeatures.id, id)),
      ),
    ]);
  }

  const [updated] = await db.select(selectShape).from(mapFeatures).where(eq(mapFeatures.id, featureId));
  return updated ?? null;
}

export async function deleteFeatureForOwner(featureId: string, ownerId: string): Promise<boolean> {
  const existing = await findFeatureForOwner(featureId, ownerId);
  if (!existing) return false;

  await db.delete(mapFeatures).where(eq(mapFeatures.id, featureId));
  return true;
}

async function findOwnedFeatureIds(featureIds: string[], ownerId: string): Promise<string[]> {
  const owned = await db
    .select({ id: mapFeatures.id })
    .from(mapFeatures)
    .innerJoin(layers, eq(mapFeatures.layerId, layers.id))
    .innerJoin(maps, eq(layers.mapId, maps.id))
    .where(and(inArray(mapFeatures.id, featureIds), eq(maps.ownerId, ownerId)));
  return owned.map((row) => row.id);
}

export async function updateFeaturesForOwner(
  featureIds: string[],
  ownerId: string,
  properties: Partial<MapFeatureProperties>,
): Promise<FeatureRow[]> {
  const owned = await db
    .select({ id: mapFeatures.id, properties: mapFeatures.properties })
    .from(mapFeatures)
    .innerJoin(layers, eq(mapFeatures.layerId, layers.id))
    .innerJoin(maps, eq(layers.mapId, maps.id))
    .where(and(inArray(mapFeatures.id, featureIds), eq(maps.ownerId, ownerId)));
  if (owned.length === 0) return [];

  const sanitizedPatch = sanitizeProperties(properties as { descriptionHtml?: string }) as Partial<MapFeatureProperties>;

  const updated = await Promise.all(
    owned.map(async (row) => {
      const [result] = await db
        .update(mapFeatures)
        .set({ properties: { ...row.properties, ...sanitizedPatch }, updatedAt: new Date() })
        .where(eq(mapFeatures.id, row.id))
        .returning(selectShape);
      return result;
    }),
  );
  return updated;
}

export async function deleteFeaturesForOwner(featureIds: string[], ownerId: string): Promise<string[]> {
  const ownedIds = await findOwnedFeatureIds(featureIds, ownerId);
  if (ownedIds.length === 0) return [];

  await db.delete(mapFeatures).where(inArray(mapFeatures.id, ownedIds));
  return ownedIds;
}

export function toMapFeatureDTO(row: FeatureRow): MapFeatureDTO {
  return {
    id: row.id,
    layerId: row.layerId,
    orderIndex: row.orderIndex,
    featureType: row.featureType as MapFeatureDTO['featureType'],
    geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
    properties: row.properties,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
