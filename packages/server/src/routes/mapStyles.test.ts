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
      googleId: `map-styles-route-test-${Date.now()}`,
      email: 'map-styles-route-test@example.com',
      displayName: 'Map Styles Route Test User',
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

describe('GET/POST/PATCH/DELETE /api/map-styles', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/map-styles').expect(401);
  });

  it('creates, lists, updates, and deletes a style end to end', async () => {
    const createRes = await agent
      .post('/api/map-styles')
      .send({ name: 'Route Test Style', styleUrl: 'mapbox://styles/someuser/abc123' })
      .expect(201);
    const styleId = createRes.body.id as string;
    expect(createRes.body.name).toBe('Route Test Style');
    expect(createRes.body.ownerId).toBe(ownerId);

    const listRes = await agent.get('/api/map-styles').expect(200);
    expect(listRes.body.map((s: { id: string }) => s.id)).toContain(styleId);

    const patchRes = await agent
      .patch(`/api/map-styles/${styleId}`)
      .send({ name: 'Renamed Style' })
      .expect(200);
    expect(patchRes.body.name).toBe('Renamed Style');

    await agent.delete(`/api/map-styles/${styleId}`).expect(204);
    await agent.patch(`/api/map-styles/${styleId}`).send({ name: 'gone' }).expect(404);
  });

  it('rejects an invalid create payload with 400', async () => {
    await agent.post('/api/map-styles').send({ name: '', styleUrl: 'not-a-style-url' }).expect(400);
  });

  it('returns 404 for a style belonging to another owner', async () => {
    const [otherUser] = await db
      .insert(users)
      .values({
        googleId: `map-styles-route-test-other-${Date.now()}`,
        email: 'map-styles-route-test-other@example.com',
      })
      .returning();

    const otherAgent = request.agent(app);
    await otherAgent.post('/api/test/login').send({ userId: otherUser.id }).expect(204);
    const created = await otherAgent
      .post('/api/map-styles')
      .send({ name: 'Other Owner Style', styleUrl: 'mapbox://styles/someuser/xyz' })
      .expect(201);

    await agent.patch(`/api/map-styles/${created.body.id}`).send({ name: 'hijack' }).expect(404);
    await agent.delete(`/api/map-styles/${created.body.id}`).expect(404);

    await db.delete(users).where(eq(users.id, otherUser.id));
  });
});
