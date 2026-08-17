import { eq } from 'drizzle-orm';
import type { Geometry } from '@mad-maps/shared';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from './maps.service';
import { createLayer } from './layers.service';
import {
  createFeature,
  deleteFeatureForOwner,
  deleteFeaturesForOwner,
  findFeatureForOwner,
  listFeaturesForLayer,
  toMapFeatureDTO,
  updateFeatureForOwner,
  updateFeaturesForOwner,
} from './features.service';

let ownerId: string;
let layerId: string;

const defaultProperties = {
  title: '',
  descriptionHtml: '',
  icon: 'marker',
  color: '#1976d2',
};

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `features-service-test-${Date.now()}`,
      email: 'features-service-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Features Test Map' });
  const layer = await createLayer(map.id, ownerId, 'Test Layer');
  layerId = layer!.id;
});

afterAll(async () => {
  // Deleting the user cascades through maps -> layers -> map_features.
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('features.service geometry round-trip', () => {
  it('round-trips a Point through ST_GeomFromGeoJSON/ST_AsGeoJSON without loss', async () => {
    const geometry: Geometry = { type: 'Point', coordinates: [-122.4194, 37.7749] };
    const created = await createFeature(layerId, ownerId, { geometry, properties: defaultProperties });

    expect(created?.featureType).toBe('point');
    const dto = toMapFeatureDTO(created!);
    expect(dto.geometry).toEqual(geometry);
  });

  it('round-trips a LineString without loss', async () => {
    const geometry: Geometry = {
      type: 'LineString',
      coordinates: [
        [-122.42, 37.77],
        [-122.41, 37.78],
        [-122.4, 37.79],
      ],
    };
    const created = await createFeature(layerId, ownerId, { geometry, properties: defaultProperties });

    expect(created?.featureType).toBe('line');
    expect(toMapFeatureDTO(created!).geometry).toEqual(geometry);
  });

  it('round-trips a Polygon without loss', async () => {
    const geometry: Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [-122.43, 37.76],
          [-122.42, 37.76],
          [-122.42, 37.77],
          [-122.43, 37.76],
        ],
      ],
    };
    const created = await createFeature(layerId, ownerId, { geometry, properties: defaultProperties });

    expect(created?.featureType).toBe('polygon');
    expect(toMapFeatureDTO(created!).geometry).toEqual(geometry);
  });

  it('round-trips an updated geometry, recomputing feature_type', async () => {
    const point: Geometry = { type: 'Point', coordinates: [0, 0] };
    const created = await createFeature(layerId, ownerId, { geometry: point, properties: defaultProperties });

    const newLine: Geometry = {
      type: 'LineString',
      coordinates: [
        [1, 1],
        [2, 2],
      ],
    };
    const updated = await updateFeatureForOwner(created!.id, ownerId, { geometry: newLine });

    expect(updated?.featureType).toBe('line');
    expect(toMapFeatureDTO(updated!).geometry).toEqual(newLine);
  });

  it('preserves featureType "text" across a Point-to-Point geometry update (e.g. a drag)', async () => {
    const point: Geometry = { type: 'Point', coordinates: [0, 0] };
    const created = await createFeature(layerId, ownerId, {
      geometry: point,
      featureType: 'text',
      properties: defaultProperties,
    });
    expect(created?.featureType).toBe('text');

    const movedPoint: Geometry = { type: 'Point', coordinates: [1, 1] };
    const updated = await updateFeatureForOwner(created!.id, ownerId, { geometry: movedPoint });

    expect(updated?.featureType).toBe('text');
    expect(toMapFeatureDTO(updated!).geometry).toEqual(movedPoint);
  });
});

describe('features.service CRUD and ownership', () => {
  it('returns null when the layer does not belong to the requesting owner', async () => {
    const otherUserId = '00000000-0000-0000-0000-000000000000';
    expect(await listFeaturesForLayer(layerId, otherUserId)).toBeNull();
    expect(
      await createFeature(layerId, otherUserId, {
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: defaultProperties,
      }),
    ).toBeNull();
  });

  it('lists features created for a layer', async () => {
    const before = (await listFeaturesForLayer(layerId, ownerId))!.length;
    await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [5, 5] },
      properties: defaultProperties,
    });
    const after = await listFeaturesForLayer(layerId, ownerId);
    expect(after!.length).toBe(before + 1);
  });

  it('merges partial property updates instead of replacing the whole object', async () => {
    const created = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { ...defaultProperties, title: 'Original', color: '#ff0000' },
    });

    const updated = await updateFeatureForOwner(created!.id, ownerId, {
      properties: { title: 'Renamed' },
    });

    expect(updated?.properties.title).toBe('Renamed');
    expect(updated?.properties.color).toBe('#ff0000');
  });

  it('deletes a feature, and findFeatureForOwner returns null afterward', async () => {
    const created = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [9, 9] },
      properties: defaultProperties,
    });

    expect(await deleteFeatureForOwner(created!.id, ownerId)).toBe(true);
    expect(await findFeatureForOwner(created!.id, ownerId)).toBeNull();
    expect(await deleteFeatureForOwner(created!.id, ownerId)).toBe(false);
  });

  it('re-sanitizes descriptionHtml server-side on create, independent of any client-side sanitization', async () => {
    const created = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [1, 1] },
      properties: {
        ...defaultProperties,
        descriptionHtml: '<p>hi</p><script>alert(1)</script>',
      },
    });

    expect(created?.properties.descriptionHtml).toBe('<p>hi</p>');
  });

  it('re-sanitizes descriptionHtml server-side on update', async () => {
    const created = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [2, 2] },
      properties: defaultProperties,
    });

    const updated = await updateFeatureForOwner(created!.id, ownerId, {
      properties: { descriptionHtml: '<img src=x onerror="alert(1)"><p>safe</p>' },
    });

    expect(updated?.properties.descriptionHtml).toBe('<p>safe</p>');
  });
});

describe('features.service batch operations', () => {
  let otherOwnerId: string;
  let otherLayerId: string;

  beforeAll(async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        googleId: `features-service-test-other-${Date.now()}`,
        email: 'features-service-test-other@example.com',
      })
      .returning();
    otherOwnerId = otherUser.id;

    const otherMap = await createMap({ ownerId: otherOwnerId, title: 'Other Owner Map' });
    const otherLayer = await createLayer(otherMap.id, otherOwnerId, 'Other Owner Layer');
    otherLayerId = otherLayer!.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, otherOwnerId));
  });

  it('updates properties on multiple owned features and returns all of them', async () => {
    const a = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [10, 10] },
      properties: { ...defaultProperties, color: '#ff0000' },
    });
    const b = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [11, 11] },
      properties: { ...defaultProperties, color: '#ff0000' },
    });

    const updated = await updateFeaturesForOwner([a!.id, b!.id], ownerId, { color: '#00ff00' });

    expect(updated).toHaveLength(2);
    expect(updated.map((f) => f.id).sort()).toEqual([a!.id, b!.id].sort());
    expect(updated.every((f) => f.properties.color === '#00ff00')).toBe(true);
  });

  it('merges partial properties per-row rather than replacing', async () => {
    const created = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [12, 12] },
      properties: { ...defaultProperties, title: 'Keep Me', color: '#ff0000' },
    });

    const [updated] = await updateFeaturesForOwner([created!.id], ownerId, { color: '#0000ff' });

    expect(updated.properties.title).toBe('Keep Me');
    expect(updated.properties.color).toBe('#0000ff');
  });

  it('silently skips feature ids not owned by the caller', async () => {
    const mine = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [13, 13] },
      properties: defaultProperties,
    });
    const theirs = await createFeature(otherLayerId, otherOwnerId, {
      geometry: { type: 'Point', coordinates: [14, 14] },
      properties: defaultProperties,
    });

    const updated = await updateFeaturesForOwner([mine!.id, theirs!.id], ownerId, { color: '#123456' });

    expect(updated.map((f) => f.id)).toEqual([mine!.id]);
    const theirsAfter = await findFeatureForOwner(theirs!.id, otherOwnerId);
    expect(theirsAfter?.properties.color).not.toBe('#123456');
  });

  it('returns an empty array when none of the requested ids are owned by the caller', async () => {
    const theirs = await createFeature(otherLayerId, otherOwnerId, {
      geometry: { type: 'Point', coordinates: [15, 15] },
      properties: defaultProperties,
    });

    const updated = await updateFeaturesForOwner([theirs!.id], ownerId, { color: '#abcdef' });

    expect(updated).toEqual([]);
  });

  it('deletes multiple owned features and returns their ids', async () => {
    const a = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [16, 16] },
      properties: defaultProperties,
    });
    const b = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [17, 17] },
      properties: defaultProperties,
    });

    const deletedIds = await deleteFeaturesForOwner([a!.id, b!.id], ownerId);

    expect(deletedIds.sort()).toEqual([a!.id, b!.id].sort());
    expect(await findFeatureForOwner(a!.id, ownerId)).toBeNull();
    expect(await findFeatureForOwner(b!.id, ownerId)).toBeNull();
  });

  it('silently skips deleting feature ids not owned by the caller', async () => {
    const mine = await createFeature(layerId, ownerId, {
      geometry: { type: 'Point', coordinates: [18, 18] },
      properties: defaultProperties,
    });
    const theirs = await createFeature(otherLayerId, otherOwnerId, {
      geometry: { type: 'Point', coordinates: [19, 19] },
      properties: defaultProperties,
    });

    const deletedIds = await deleteFeaturesForOwner([mine!.id, theirs!.id], ownerId);

    expect(deletedIds).toEqual([mine!.id]);
    expect(await findFeatureForOwner(theirs!.id, otherOwnerId)).not.toBeNull();
  });
});
