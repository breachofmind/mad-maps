import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { searchPlaces } from '../services/googlePlaces.service';

jest.mock('../services/googlePlaces.service');
const mockedSearchPlaces = searchPlaces as jest.MockedFunction<typeof searchPlaces>;

const app = createApp();

let ownerId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `search-route-test-${Date.now()}`,
      email: 'search-route-test@example.com',
    })
    .returning();
  ownerId = user.id;

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterEach(() => {
  mockedSearchPlaces.mockReset();
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('GET /api/search', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get('/api/search?q=golden+gate').expect(401);
  });

  it('rejects a missing query with 400', async () => {
    await agent.get('/api/search').expect(400);
  });

  it('returns the mapped results from googlePlaces.service on success', async () => {
    mockedSearchPlaces.mockResolvedValue([
      {
        placeId: 'p1',
        name: 'Golden Gate Park',
        formattedAddress: 'SF, CA',
        lng: -122.48,
        lat: 37.77,
        googleMapsUri: 'https://maps.google.com/?cid=123',
        rating: 4.6,
        userRatingCount: 12345,
      },
    ]);

    const res = await agent.get('/api/search?q=golden+gate').expect(200);

    expect(mockedSearchPlaces).toHaveBeenCalledWith('golden gate');
    expect(res.body).toEqual([
      {
        placeId: 'p1',
        name: 'Golden Gate Park',
        formattedAddress: 'SF, CA',
        lng: -122.48,
        lat: 37.77,
        googleMapsUri: 'https://maps.google.com/?cid=123',
        rating: 4.6,
        userRatingCount: 12345,
      },
    ]);
  });

  it('returns 502 when the service throws (e.g. missing API key or upstream failure)', async () => {
    mockedSearchPlaces.mockRejectedValue(new Error('GOOGLE_MAPS_API_KEY is not configured'));

    await agent.get('/api/search?q=anywhere').expect(502);
  });
});
