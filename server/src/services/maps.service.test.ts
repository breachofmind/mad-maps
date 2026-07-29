import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import {
  createMap,
  deleteMapForOwner,
  getMapForOwner,
  listMapsForUser,
  updateMapForOwner,
} from './maps.service';

let ownerId: string;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `maps-service-test-${Date.now()}`,
      email: 'maps-service-test@example.com',
      displayName: 'Maps Service Test User',
    })
    .returning();
  ownerId = user.id;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('maps.service', () => {
  it('creates a map with sensible defaults and lists it for the owner', async () => {
    const created = await createMap({ ownerId, title: 'My First Map' });

    expect(created.title).toBe('My First Map');
    expect(created.baseStyle).toBe('mapbox://styles/mapbox/streets-v12');
    expect(created.defaultZoom).toBeCloseTo(3.5);

    const list = await listMapsForUser(ownerId);
    expect(list.map((m) => m.id)).toContain(created.id);
  });

  it('fetches a map only for its owner, returning null for a mismatched owner', async () => {
    const created = await createMap({ ownerId, title: 'Owner Scoped Map' });

    const found = await getMapForOwner(created.id, ownerId);
    expect(found?.id).toBe(created.id);

    const notFound = await getMapForOwner(created.id, '00000000-0000-0000-0000-000000000000');
    expect(notFound).toBeNull();
  });

  it('updates title, style, center, and zoom', async () => {
    const created = await createMap({ ownerId, title: 'To Update' });

    const updated = await updateMapForOwner(created.id, ownerId, {
      title: 'Updated Title',
      baseStyle: 'mapbox://styles/mapbox/satellite-streets-v12',
      defaultCenter: { lng: -122.4, lat: 37.8 },
      defaultZoom: 10,
    });

    expect(updated?.title).toBe('Updated Title');
    expect(updated?.baseStyle).toBe('mapbox://styles/mapbox/satellite-streets-v12');
    expect(updated?.defaultCenter).toEqual({ lng: -122.4, lat: 37.8 });
    expect(updated?.defaultZoom).toBeCloseTo(10);
  });

  it('deletes a map, and returns false when deleting again', async () => {
    const created = await createMap({ ownerId, title: 'To Delete' });

    const firstDelete = await deleteMapForOwner(created.id, ownerId);
    expect(firstDelete).toBe(true);

    const secondDelete = await deleteMapForOwner(created.id, ownerId);
    expect(secondDelete).toBe(false);

    const found = await getMapForOwner(created.id, ownerId);
    expect(found).toBeNull();
  });
});
