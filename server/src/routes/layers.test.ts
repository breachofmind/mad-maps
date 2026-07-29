import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users, maps } from '../db/schema';
import { createMap } from '../services/maps.service';

const app = createApp();

let ownerId: string;
let mapId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `layers-route-test-${Date.now()}`,
      email: 'layers-route-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Layers Route Test Map' });
  mapId = map.id;

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterAll(async () => {
  await db.delete(maps).where(eq(maps.ownerId, ownerId));
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('layer routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get(`/api/maps/${mapId}/layers`).expect(401);
  });

  it('returns 404 for a map that does not exist / is not owned', async () => {
    await agent.get('/api/maps/00000000-0000-0000-0000-000000000000/layers').expect(404);
  });

  it('creates, lists, renames, toggles visibility, reorders, and deletes layers', async () => {
    const first = await agent
      .post(`/api/maps/${mapId}/layers`)
      .send({ name: 'Trails' })
      .expect(201);
    const second = await agent
      .post(`/api/maps/${mapId}/layers`)
      .send({ name: 'Points of Interest' })
      .expect(201);

    const listRes = await agent.get(`/api/maps/${mapId}/layers`).expect(200);
    expect(listRes.body.map((l: { name: string }) => l.name)).toEqual([
      'Trails',
      'Points of Interest',
    ]);

    const patchRes = await agent
      .patch(`/api/layers/${first.body.id}`)
      .send({ name: 'Renamed Trails', visible: false })
      .expect(200);
    expect(patchRes.body.name).toBe('Renamed Trails');
    expect(patchRes.body.visible).toBe(false);

    const reorderRes = await agent
      .patch(`/api/maps/${mapId}/layers/reorder`)
      .send({ layerIds: [second.body.id, first.body.id] })
      .expect(200);
    expect(reorderRes.body.map((l: { id: string }) => l.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);

    await agent.delete(`/api/layers/${first.body.id}`).expect(204);
    await agent.delete(`/api/layers/${first.body.id}`).expect(404);

    const finalList = await agent.get(`/api/maps/${mapId}/layers`).expect(200);
    expect(finalList.body.map((l: { id: string }) => l.id)).toEqual([second.body.id]);
  });

  it('rejects an invalid create payload with 400', async () => {
    await agent.post(`/api/maps/${mapId}/layers`).send({ name: '' }).expect(400);
  });
});
