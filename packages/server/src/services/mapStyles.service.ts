import { and, eq } from 'drizzle-orm';
import type { BaseStyle, MapStyleDTO } from '@mad-maps/shared';
import { db } from '../db/client';
import { mapStyles, type MapStyle } from '../db/schema';

export interface CreateMapStyleInput {
  ownerId: string;
  name: string;
  styleUrl: BaseStyle;
}

export interface UpdateMapStyleInput {
  name?: string;
  styleUrl?: BaseStyle;
}

export async function listMapStylesForOwner(ownerId: string) {
  return db.select().from(mapStyles).where(eq(mapStyles.ownerId, ownerId)).orderBy(mapStyles.createdAt);
}

export async function createMapStyle(input: CreateMapStyleInput) {
  const [created] = await db
    .insert(mapStyles)
    .values({ ownerId: input.ownerId, name: input.name, styleUrl: input.styleUrl })
    .returning();
  return created;
}

export async function updateMapStyleForOwner(styleId: string, ownerId: string, input: UpdateMapStyleInput) {
  const [updated] = await db
    .update(mapStyles)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(mapStyles.id, styleId), eq(mapStyles.ownerId, ownerId)))
    .returning();
  return updated ?? null;
}

export async function deleteMapStyleForOwner(styleId: string, ownerId: string) {
  const [deleted] = await db
    .delete(mapStyles)
    .where(and(eq(mapStyles.id, styleId), eq(mapStyles.ownerId, ownerId)))
    .returning({ id: mapStyles.id });
  return Boolean(deleted);
}

export function toMapStyleDTO(style: MapStyle): MapStyleDTO {
  return {
    id: style.id,
    ownerId: style.ownerId,
    name: style.name,
    styleUrl: style.styleUrl,
    createdAt: style.createdAt.toISOString(),
    updatedAt: style.updatedAt.toISOString(),
  };
}
