import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import * as pmtilesInspectService from '../services/pmtilesInspect.service';
import { PmtilesInspectError } from '../services/pmtilesInspect.service';

const app = createApp();

let ownerId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `pmtiles-route-test-${Date.now()}`,
      email: 'pmtiles-route-test@example.com',
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

describe('POST /api/pmtiles/inspect', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects unauthenticated requests with 401', async () => {
    await request(app).post('/api/pmtiles/inspect').send({ url: 'https://example.com/data.pmtiles' }).expect(401);
  });

  it('rejects an invalid url with 400', async () => {
    await agent.post('/api/pmtiles/inspect').send({ url: 'not-a-url' }).expect(400);
  });

  it('returns metadata for a valid archive', async () => {
    const metadata = {
      layers: [{ id: 'roads', fields: { name: 'String' as const } }],
      minzoom: 0,
      maxzoom: 14,
    };
    jest.spyOn(pmtilesInspectService, 'inspectPmtiles').mockResolvedValue(metadata);

    const res = await agent.post('/api/pmtiles/inspect').send({ url: 'https://example.com/data.pmtiles' }).expect(200);

    expect(res.body).toEqual(metadata);
    expect(pmtilesInspectService.inspectPmtiles).toHaveBeenCalledWith('https://example.com/data.pmtiles');
  });

  it('passes through the inspect service error status and message', async () => {
    jest
      .spyOn(pmtilesInspectService, 'inspectPmtiles')
      .mockRejectedValue(new PmtilesInspectError('Only vector (MVT) PMTiles archives are supported', 400));

    const res = await agent.post('/api/pmtiles/inspect').send({ url: 'https://example.com/raster.pmtiles' }).expect(400);

    expect(res.body.error).toBe('Only vector (MVT) PMTiles archives are supported');
  });
});
