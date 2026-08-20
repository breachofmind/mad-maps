import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import * as pluginRegistry from '../plugins/pluginRegistry';

const app = createApp();

let ownerId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `plugins-route-test-${Date.now()}`,
      email: 'plugins-route-test@example.com',
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

describe('GET /api/plugins', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/plugins').expect(401);
  });

  it('returns the id/name/description of every loaded plugin, without the handler', async () => {
    jest.spyOn(pluginRegistry, 'listPlugins').mockReturnValue([
      { id: 'weather-forecast', name: 'Weather Forecast', description: 'A 5-day forecast', handler: () => ({ blocks: [] }) },
    ]);

    const res = await agent.get('/api/plugins').expect(200);

    expect(res.body).toEqual([{ id: 'weather-forecast', name: 'Weather Forecast', description: 'A 5-day forecast' }]);
  });

  it('returns an empty array when no plugins are loaded', async () => {
    jest.spyOn(pluginRegistry, 'listPlugins').mockReturnValue([]);

    const res = await agent.get('/api/plugins').expect(200);

    expect(res.body).toEqual([]);
  });
});
