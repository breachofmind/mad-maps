import { and, eq } from 'drizzle-orm';
import type { MapDTO } from '@mad-maps/shared';
import { db } from '../db/client';
import { maps, type LngLat, type Map } from '../db/schema';

export interface CreateMapInput {
  ownerId: string;
  title: string;
  description?: string | null;
}

export interface UpdateMapInput {
  title?: string;
  description?: string | null;
  baseStyle?: string;
  defaultCenter?: LngLat;
  defaultZoom?: number;
}

export async function listMapsForUser(ownerId: string) {
  return db.select().from(maps).where(eq(maps.ownerId, ownerId)).orderBy(maps.updatedAt);
}

export async function createMap(input: CreateMapInput) {
  const [created] = await db
    .insert(maps)
    .values({ ownerId: input.ownerId, title: input.title, description: input.description ?? null })
    .returning();
  return created;
}

export async function getMapForOwner(mapId: string, ownerId: string) {
  const [found] = await db
    .select()
    .from(maps)
    .where(and(eq(maps.id, mapId), eq(maps.ownerId, ownerId)));
  return found ?? null;
}

export async function updateMapForOwner(mapId: string, ownerId: string, input: UpdateMapInput) {
  const [updated] = await db
    .update(maps)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(maps.id, mapId), eq(maps.ownerId, ownerId)))
    .returning();
  return updated ?? null;
}

export async function deleteMapForOwner(mapId: string, ownerId: string) {
  const [deleted] = await db
    .delete(maps)
    .where(and(eq(maps.id, mapId), eq(maps.ownerId, ownerId)))
    .returning({ id: maps.id });
  return Boolean(deleted);
}

export function toMapDTO(map: Map): MapDTO {
  return {
    id: map.id,
    ownerId: map.ownerId,
    title: map.title,
    description: map.description,
    baseStyle: map.baseStyle,
    defaultCenter: map.defaultCenter,
    defaultZoom: map.defaultZoom,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
  };
}
