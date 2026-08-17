import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import {
  createMapStyle,
  deleteMapStyleForOwner,
  listMapStylesForOwner,
  updateMapStyleForOwner,
} from './mapStyles.service';

let ownerId: string;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `map-styles-service-test-${Date.now()}`,
      email: 'map-styles-service-test@example.com',
      displayName: 'Map Styles Service Test User',
    })
    .returning();
  ownerId = user.id;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('mapStyles.service', () => {
  it('creates a style and lists it for the owner', async () => {
    const created = await createMapStyle({
      ownerId,
      name: 'My Style',
      styleUrl: 'mapbox://styles/someuser/abc123',
    });

    expect(created.name).toBe('My Style');
    expect(created.styleUrl).toBe('mapbox://styles/someuser/abc123');

    const list = await listMapStylesForOwner(ownerId);
    expect(list.map((s) => s.id)).toContain(created.id);
  });

  it('updates name and style url, scoped to the owner', async () => {
    const created = await createMapStyle({
      ownerId,
      name: 'To Update',
      styleUrl: 'mapbox://styles/someuser/original',
    });

    const updated = await updateMapStyleForOwner(created.id, ownerId, {
      name: 'Updated Name',
      styleUrl: 'mapbox://styles/someuser/updated',
    });
    expect(updated?.name).toBe('Updated Name');
    expect(updated?.styleUrl).toBe('mapbox://styles/someuser/updated');

    const notFound = await updateMapStyleForOwner(created.id, '00000000-0000-0000-0000-000000000000', {
      name: 'Should not apply',
    });
    expect(notFound).toBeNull();
  });

  it('deletes a style, and returns false when deleting again', async () => {
    const created = await createMapStyle({
      ownerId,
      name: 'To Delete',
      styleUrl: 'mapbox://styles/someuser/todelete',
    });

    const firstDelete = await deleteMapStyleForOwner(created.id, ownerId);
    expect(firstDelete).toBe(true);

    const secondDelete = await deleteMapStyleForOwner(created.id, ownerId);
    expect(secondDelete).toBe(false);
  });
});
