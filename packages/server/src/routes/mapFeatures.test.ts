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

  describe('batch routes', () => {
    it('rejects unauthenticated requests with 401', async () => {
      await request(app).patch('/api/mapFeatures/batch').send({ featureIds: ['x'], properties: {} }).expect(401);
      await request(app).delete('/api/mapFeatures/batch').send({ featureIds: ['x'] }).expect(401);
    });

    it('is not swallowed by the /:featureId route — batch PATCH returns an array, not a single-feature 400', async () => {
      const createRes = await agent
        .post(`/api/layers/${layerId}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [20, 20] }, properties: { color: '#111111' } })
        .expect(201);
      const featureId = createRes.body.id as string;

      const patchRes = await agent
        .patch('/api/mapFeatures/batch')
        .send({ featureIds: [featureId], properties: { color: '#222222' } })
        .expect(200);

      expect(Array.isArray(patchRes.body)).toBe(true);
      expect(patchRes.body[0].properties.color).toBe('#222222');
    });

    it('rejects an empty featureIds array with 400', async () => {
      await agent.patch('/api/mapFeatures/batch').send({ featureIds: [], properties: { color: '#000000' } }).expect(400);
      await agent.delete('/api/mapFeatures/batch').send({ featureIds: [] }).expect(400);
    });

    it('updates multiple features in one call and silently ignores ids owned by another user', async () => {
      const [otherUser] = await db
        .insert(users)
        .values({
          googleId: `map-features-route-test-batch-other-${Date.now()}`,
          email: 'map-features-route-test-batch-other@example.com',
        })
        .returning();
      const otherMap = await createMap({ ownerId: otherUser.id, title: 'Batch Other Owner Map' });
      const otherLayer = await createLayer(otherMap.id, otherUser.id, 'Batch Other Owner Layer');

      const a = await agent
        .post(`/api/layers/${layerId}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [21, 21] }, properties: { color: '#111111' } })
        .expect(201);
      const b = await agent
        .post(`/api/layers/${layerId}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [22, 22] }, properties: { color: '#111111' } })
        .expect(201);

      const otherAgent = request.agent(app);
      await otherAgent.post('/api/test/login').send({ userId: otherUser.id }).expect(204);
      const theirs = await otherAgent
        .post(`/api/layers/${otherLayer!.id}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [23, 23] }, properties: { color: '#111111' } })
        .expect(201);

      const patchRes = await agent
        .patch('/api/mapFeatures/batch')
        .send({
          featureIds: [a.body.id, b.body.id, theirs.body.id],
          properties: { color: '#333333' },
        })
        .expect(200);

      expect(patchRes.body.map((f: { id: string }) => f.id).sort()).toEqual([a.body.id, b.body.id].sort());
      expect(patchRes.body.every((f: { properties: { color: string } }) => f.properties.color === '#333333')).toBe(
        true,
      );

      const theirsAfter = await otherAgent.get(`/api/layers/${otherLayer!.id}/mapFeatures`).expect(200);
      expect(theirsAfter.body.find((f: { id: string }) => f.id === theirs.body.id).properties.color).toBe(
        '#111111',
      );

      await db.delete(users).where(eq(users.id, otherUser.id));
    });

    it('deletes multiple features in one call and returns their ids', async () => {
      const a = await agent
        .post(`/api/layers/${layerId}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [24, 24] } })
        .expect(201);
      const b = await agent
        .post(`/api/layers/${layerId}/mapFeatures`)
        .send({ geometry: { type: 'Point', coordinates: [25, 25] } })
        .expect(201);

      const deleteRes = await agent
        .delete('/api/mapFeatures/batch')
        .send({ featureIds: [a.body.id, b.body.id] })
        .expect(200);

      expect(deleteRes.body.deletedIds.sort()).toEqual([a.body.id, b.body.id].sort());
      await agent.delete(`/api/mapFeatures/${a.body.id}`).expect(404);
      await agent.delete(`/api/mapFeatures/${b.body.id}`).expect(404);
    });
  });
});
