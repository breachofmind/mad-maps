import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { LayerDTO, PmtilesMetadata } from '@mad-maps/shared';
import { db } from '../db/client';
import { layers, maps, type Layer, type LayerStyleConfig } from '../db/schema';
import { getMapForOwner } from './maps.service';

export interface CreateLayerSource {
  url: string;
  format: 'geojson' | 'pmtiles' | 'raster';
  sourceLayer?: string;
  pmtilesMetadata?: PmtilesMetadata;
}

const SOURCE_TYPE_BY_FORMAT = {
  geojson: 'geojson-url',
  pmtiles: 'pmtiles-url',
  raster: 'raster-url',
} as const;

export interface UpdateLayerInput {
  name?: string;
  visible?: boolean;
  color?: string;
  defaultIcon?: string;
  opacity?: number;
  styleConfig?: LayerStyleConfig | null;
  pluginEndpointUrl?: string | null;
  pluginId?: string | null;
}

export async function listLayersForMap(mapId: string, ownerId: string): Promise<Layer[] | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;
  return db.select().from(layers).where(eq(layers.mapId, mapId)).orderBy(asc(layers.orderIndex));
}

export async function createLayer(
  mapId: string,
  ownerId: string,
  name: string,
  source?: CreateLayerSource,
): Promise<Layer | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  // New layers land at the top of the panel (orderIndex 0), so existing
  // layers need to shift down to make room before the insert.
  await db
    .update(layers)
    .set({ orderIndex: sql`${layers.orderIndex} + 1`, updatedAt: new Date() })
    .where(eq(layers.mapId, mapId));

  const [created] = await db
    .insert(layers)
    .values({
      mapId,
      name,
      orderIndex: 0,
      sourceType: source ? SOURCE_TYPE_BY_FORMAT[source.format] : 'local',
      sourceUrl: source?.url ?? null,
      sourceLayer: source?.format === 'pmtiles' ? (source.sourceLayer ?? null) : null,
      pmtilesMetadata: source?.format === 'pmtiles' ? (source.pmtilesMetadata ?? null) : null,
    })
    .returning();
  return created;
}

export async function findLayerForOwner(layerId: string, ownerId: string): Promise<Layer | null> {
  const [row] = await db
    .select({ layer: layers })
    .from(layers)
    .innerJoin(maps, eq(layers.mapId, maps.id))
    .where(and(eq(layers.id, layerId), eq(maps.ownerId, ownerId)));
  return row?.layer ?? null;
}

export async function updateLayerForOwner(
  layerId: string,
  ownerId: string,
  input: UpdateLayerInput,
): Promise<Layer | null> {
  const existing = await findLayerForOwner(layerId, ownerId);
  if (!existing) return null;

  // pluginEndpointUrl and pluginId are mutually exclusive — setting one to
  // a non-null value always clears the other, regardless of what else the
  // caller's patch does or doesn't mention, so the two can never both end
  // up set on the same row.
  const patch = { ...input };
  if (patch.pluginId != null) {
    patch.pluginEndpointUrl = null;
  } else if (patch.pluginEndpointUrl != null) {
    patch.pluginId = null;
  }

  const [updated] = await db
    .update(layers)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(layers.id, layerId))
    .returning();
  return updated;
}

export async function deleteLayerForOwner(layerId: string, ownerId: string): Promise<boolean> {
  const existing = await findLayerForOwner(layerId, ownerId);
  if (!existing) return false;

  await db.delete(layers).where(eq(layers.id, layerId));
  return true;
}

export async function reorderLayers(
  mapId: string,
  ownerId: string,
  layerIds: string[],
): Promise<Layer[] | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const existing = await db.select().from(layers).where(eq(layers.mapId, mapId));
  const existingIds = new Set(existing.map((l) => l.id));
  const isValidReorder =
    layerIds.length === existing.length && layerIds.every((id) => existingIds.has(id));
  if (!isValidReorder) return null;

  await Promise.all(
    layerIds.map((id, index) =>
      db.update(layers).set({ orderIndex: index, updatedAt: new Date() }).where(eq(layers.id, id)),
    ),
  );

  return db.select().from(layers).where(inArray(layers.id, layerIds)).orderBy(asc(layers.orderIndex));
}

export function toLayerDTO(layer: Layer): LayerDTO {
  return {
    id: layer.id,
    mapId: layer.mapId,
    name: layer.name,
    orderIndex: layer.orderIndex,
    visible: layer.visible,
    color: layer.color,
    defaultIcon: layer.defaultIcon,
    opacity: layer.opacity,
    sourceType: layer.sourceType,
    sourceUrl: layer.sourceUrl,
    sourceLayer: layer.sourceLayer,
    pmtilesMetadata: layer.pmtilesMetadata ?? null,
    styleConfig: layer.styleConfig ?? null,
    pluginEndpointUrl: layer.pluginEndpointUrl,
    pluginId: layer.pluginId,
    createdAt: layer.createdAt.toISOString(),
    updatedAt: layer.updatedAt.toISOString(),
  };
}
