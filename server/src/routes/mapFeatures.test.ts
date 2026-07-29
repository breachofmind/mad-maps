import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from '../services/maps.service';
import { createLayer } from '../services/layers.service';

const app = createApp();

let ownerId: string;
let layerId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `map-features-route-test-${Date.now()}`,
      email: 'map-features-route-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Feature Route Test Map' });
  const layer = await createLayer(map.id, ownerId, 'Route Test Layer');
  layerId = layer!.id;

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('map feature routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get(`/api/layers/${layerId}/mapFeatures`).expect(401);
  });

  it('rejects an invalid geometry with 400', async () => {
    await agent
      .post(`/api/layers/${layerId}/mapFeatures`)
      .send({ geometry: { type: 'Point', coordinates: [0] } })
      .expect(400);
  });

  it('creates, lists, updates, and deletes a feature end to end', async () => {
    const createRes = await agent
      .post(`/api/layers/${layerId}/mapFeatures`)
      .send({
        geometry: { type: 'Point', coordinates: [-122.4, 37.8] },
        properties: { title: 'Golden Gate', color: '#00ff00' },
      })
      .expect(201);

    expect(createRes.body.featureType).toBe('point');
    expect(createRes.body.geometry).toEqual({ type: 'Point', coordinates: [-122.4, 37.8] });
    expect(createRes.body.properties.title).toBe('Golden Gate');
    expect(createRes.body.properties.color).toBe('#00ff00');
    expect(createRes.body.properties.icon).toBe('marker');

    const featureId = createRes.body.id as string;

    const listRes = await agent.get(`/api/layers/${layerId}/mapFeatures`).expect(200);
    expect(listRes.body.map((f: { id: string }) => f.id)).toContain(featureId);

    const patchRes = await agent
      .patch(`/api/mapFeatures/${featureId}`)
      .send({
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
        properties: { title: 'Renamed' },
      })
      .expect(200);
    expect(patchRes.body.featureType).toBe('line');
    expect(patchRes.body.properties.title).toBe('Renamed');
    expect(patchRes.body.properties.color).toBe('#00ff00');

    await agent.delete(`/api/mapFeatures/${featureId}`).expect(204);
    await agent.delete(`/api/mapFeatures/${featureId}`).expect(404);
  });

  it('returns 404 when listing features for a layer owned by another user', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        googleId: `map-features-route-test-other-${Date.now()}`,
        email: 'map-features-route-test-other@example.com',
      })
      .returning();
    const otherMap = await createMap({ ownerId: otherUser.id, title: 'Other Owner Map' });
    const otherLayer = await createLayer(otherMap.id, otherUser.id, 'Other Owner Layer');

    await agent.get(`/api/layers/${otherLayer!.id}/mapFeatures`).expect(404);

    await db.delete(users).where(eq(users.id, otherUser.id));
  });
});
