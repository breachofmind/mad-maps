import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';

const app = createApp();

let ownerId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `maps-route-test-${Date.now()}`,
      email: 'maps-route-test@example.com',
      displayName: 'Maps Route Test User',
    })
    .returning();
  ownerId = user.id;

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('GET/POST/PATCH/DELETE /api/maps', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/maps').expect(401);
  });

  it('creates, lists, updates, and deletes a map end to end', async () => {
    const createRes = await agent.post('/api/maps').send({ title: 'Route Test Map' }).expect(201);
    const mapId = createRes.body.id as string;
    expect(createRes.body.title).toBe('Route Test Map');
    expect(createRes.body.ownerId).toBe(ownerId);

    const listRes = await agent.get('/api/maps').expect(200);
    expect(listRes.body.map((m: { id: string }) => m.id)).toContain(mapId);

    const patchRes = await agent
      .patch(`/api/maps/${mapId}`)
      .send({ defaultCenter: { lng: 10, lat: 20 }, defaultZoom: 8 })
      .expect(200);
    expect(patchRes.body.defaultCenter).toEqual({ lng: 10, lat: 20 });
    expect(patchRes.body.defaultZoom).toBe(8);

    await agent.delete(`/api/maps/${mapId}`).expect(204);
    await agent.get(`/api/maps/${mapId}`).expect(404);
  });

  it('rejects an invalid create payload with 400', async () => {
    await agent.post('/api/maps').send({ title: '' }).expect(400);
  });

  it('returns 404 for a map belonging to another owner', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        googleId: `maps-route-test-other-${Date.now()}`,
        email: 'maps-route-test-other@example.com',
      })
      .returning();

    const otherAgent = request.agent(app);
    await otherAgent.post('/api/test/login').send({ userId: otherUser.id }).expect(204);
    const created = await otherAgent.post('/api/maps').send({ title: 'Other Owner Map' }).expect(201);

    await agent.get(`/api/maps/${created.body.id}`).expect(404);

    await db.delete(users).where(eq(users.id, otherUser.id));
  });
});
