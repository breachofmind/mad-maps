import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from '../services/maps.service';

const app = createApp();

let ownerId: string;
let mapId: string;
let agent: ReturnType<typeof request.agent>;

const validGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1, 2] },
      properties: { title: 'Route Test Pin' },
    },
  ],
});

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `import-route-test-${Date.now()}`,
      email: 'import-route-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Import Route Test Map' });
  mapId = map.id;

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('POST /api/maps/:mapId/import', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app)
      .post(`/api/maps/${mapId}/import`)
      .attach('file', Buffer.from(validGeoJson), 'pins.geojson')
      .expect(401);
  });

  it('rejects a request with no file with 400', async () => {
    await agent.post(`/api/maps/${mapId}/import`).expect(400);
  });

  it('returns 404 for a map not owned by the requester', async () => {
    await agent
      .post('/api/maps/00000000-0000-0000-0000-000000000000/import')
      .attach('file', Buffer.from(validGeoJson), 'pins.geojson')
      .expect(404);
  });

  it('rejects a malformed file with 400 and a clear error', async () => {
    const res = await agent
      .post(`/api/maps/${mapId}/import`)
      .attach('file', Buffer.from('not json at all'), 'pins.geojson')
      .expect(400);

    expect(res.body.error).toMatch(/valid/i);
  });

  it('imports a valid GeoJSON file as a new layer named after the file', async () => {
    const res = await agent
      .post(`/api/maps/${mapId}/import`)
      .attach('file', Buffer.from(validGeoJson), 'My Pins.geojson')
      .expect(201);

    expect(res.body.layerName).toBe('My Pins');
    expect(res.body.featureCount).toBe(1);
  });
});

describe('POST /api/maps/import', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app)
      .post('/api/maps/import')
      .attach('file', Buffer.from(validGeoJson), 'pins.geojson')
      .expect(401);
  });

  it('creates a brand-new map from a valid GeoJSON file', async () => {
    const res = await agent
      .post('/api/maps/import')
      .attach('file', Buffer.from(validGeoJson), 'New Map.geojson')
      .expect(201);

    expect(res.body.mapId).toBeTruthy();
    expect(res.body.layerName).toBe('New Map');
    expect(res.body.featureCount).toBe(1);
  });
});
