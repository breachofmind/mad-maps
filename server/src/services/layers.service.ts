import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { LayerDTO } from '@mapinski/shared';
import { db } from '../db/client';
import { layers, maps, type Layer } from '../db/schema';
import { getMapForOwner } from './maps.service';

export interface UpdateLayerInput {
  name?: string;
  visible?: boolean;
  color?: string;
}

export async function listLayersForMap(mapId: string, ownerId: string): Promise<Layer[] | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;
  return db.select().from(layers).where(eq(layers.mapId, mapId)).orderBy(asc(layers.orderIndex));
}

export async function createLayer(mapId: string, ownerId: string, name: string): Promise<Layer | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(layers)
    .where(eq(layers.mapId, mapId));

  const [created] = await db.insert(layers).values({ mapId, name, orderIndex: count }).returning();
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

  const [updated] = await db
    .update(layers)
    .set({ ...input, updatedAt: new Date() })
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
    createdAt: layer.createdAt.toISOString(),
    updatedAt: layer.updatedAt.toISOString(),
  };
}
