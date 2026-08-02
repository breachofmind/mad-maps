import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { users, maps } from '../db/schema';
import { createMap } from './maps.service';
import {
  createLayer,
  deleteLayerForOwner,
  listLayersForMap,
  reorderLayers,
  toLayerDTO,
  updateLayerForOwner,
} from './layers.service';

let ownerId: string;
let mapId: string;
let otherOwnerId: string;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `layers-service-test-${Date.now()}`,
      email: 'layers-service-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const [otherUser] = await db
    .insert(users)
    .values({
      googleId: `layers-service-test-other-${Date.now()}`,
      email: 'layers-service-test-other@example.com',
    })
    .returning();
  otherOwnerId = otherUser.id;

  const map = await createMap({ ownerId, title: 'Layers Test Map' });
  mapId = map.id;
});

afterAll(async () => {
  await db.delete(maps).where(eq(maps.ownerId, ownerId));
  await db.delete(users).where(eq(users.id, ownerId));
  await db.delete(users).where(eq(users.id, otherOwnerId));
  await pool.end();
});

describe('layers.service', () => {
  it('returns null when the map does not belong to the requesting owner', async () => {
    expect(await listLayersForMap(mapId, otherOwnerId)).toBeNull();
    expect(await createLayer(mapId, otherOwnerId, 'Nope')).toBeNull();
  });

  it('creates each new layer at the top (order index 0), pushing existing layers down', async () => {
    const first = await createLayer(mapId, ownerId, 'Trails');
    const second = await createLayer(mapId, ownerId, 'Points of Interest');

    expect(first?.orderIndex).toBe(0);
    expect(second?.orderIndex).toBe(0);

    const list = await listLayersForMap(mapId, ownerId);
    expect(list?.map((l) => l.name)).toEqual(['Points of Interest', 'Trails']);
  });

  it('renames and toggles visibility for a layer', async () => {
    const created = await createLayer(mapId, ownerId, 'To Rename');
    const updated = await updateLayerForOwner(created!.id, ownerId, {
      name: 'Renamed',
      visible: false,
    });

    expect(updated?.name).toBe('Renamed');
    expect(updated?.visible).toBe(false);
  });

  it('refuses to update a layer for a non-owning user', async () => {
    const created = await createLayer(mapId, ownerId, 'Owner Only');
    const updated = await updateLayerForOwner(created!.id, otherOwnerId, { name: 'Hijacked' });
    expect(updated).toBeNull();
  });

  it('reorders layers and rejects a mismatched id set', async () => {
    const list = (await listLayersForMap(mapId, ownerId))!;
    const reversedIds = [...list].reverse().map((l) => l.id);

    const reordered = await reorderLayers(mapId, ownerId, reversedIds);
    expect(reordered?.map((l) => l.id)).toEqual(reversedIds);
    expect(reordered?.map((l) => l.orderIndex)).toEqual(reversedIds.map((_, i) => i));

    const invalid = await reorderLayers(mapId, ownerId, [reversedIds[0]]);
    expect(invalid).toBeNull();
  });

  it('deletes a layer, and returns false when deleting again', async () => {
    const created = await createLayer(mapId, ownerId, 'To Delete');

    expect(await deleteLayerForOwner(created!.id, ownerId)).toBe(true);
    expect(await deleteLayerForOwner(created!.id, ownerId)).toBe(false);
  });

  it('defaults to a local layer, and marks a layer with a sourceUrl as geojson-url', async () => {
    const local = await createLayer(mapId, ownerId, 'Local Layer');
    expect(local?.sourceType).toBe('local');
    expect(local?.sourceUrl).toBeNull();

    const remote = await createLayer(mapId, ownerId, 'Remote Layer', {
      url: 'https://example.com/data.geojson',
      format: 'geojson',
    });
    expect(remote?.sourceType).toBe('geojson-url');
    expect(remote?.sourceUrl).toBe('https://example.com/data.geojson');
  });

  it('creates a pmtiles-url layer with sourceLayer and pmtilesMetadata, and round-trips through the DTO', async () => {
    const pmtilesMetadata = {
      layers: [{ id: 'roads', fields: { name: 'String' as const } }],
      minzoom: 0,
      maxzoom: 14,
    };
    const created = await createLayer(mapId, ownerId, 'Roads', {
      url: 'https://example.com/data.pmtiles',
      format: 'pmtiles',
      sourceLayer: 'roads',
      pmtilesMetadata,
    });

    expect(created?.sourceType).toBe('pmtiles-url');
    expect(created?.sourceUrl).toBe('https://example.com/data.pmtiles');
    expect(created?.sourceLayer).toBe('roads');
    expect(created?.pmtilesMetadata).toEqual(pmtilesMetadata);

    const dto = toLayerDTO(created!);
    expect(dto.sourceType).toBe('pmtiles-url');
    expect(dto.sourceLayer).toBe('roads');
    expect(dto.pmtilesMetadata).toEqual(pmtilesMetadata);
  });

  it('defaults styleConfig to null, sets it, and clears it back to null', async () => {
    const created = await createLayer(mapId, ownerId, 'Weather');
    expect(created?.styleConfig).toBeNull();

    const styleConfig = {
      labelProperty: 'temp',
      colorProperty: 'temp',
      colorStops: [
        { value: 0, color: '#1976d2' },
        { value: 100, color: '#d32f2f' },
      ],
      iconProperty: 'cover',
      iconRules: [{ value: 'CLR', iconUrl: 'https://example.com/icons/sun.png' }],
    };
    const updated = await updateLayerForOwner(created!.id, ownerId, { styleConfig });
    expect(updated?.styleConfig).toEqual(styleConfig);

    const cleared = await updateLayerForOwner(created!.id, ownerId, { styleConfig: null });
    expect(cleared?.styleConfig).toBeNull();
  });
});
