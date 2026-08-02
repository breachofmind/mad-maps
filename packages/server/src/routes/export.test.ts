import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from '../services/maps.service';
import { createLayer } from '../services/layers.service';
import { createFeature } from '../services/features.service';

const app = createApp();

let ownerId: string;
let mapId: string;
let agent: ReturnType<typeof request.agent>;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `export-route-test-${Date.now()}`,
      email: 'export-route-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Export Route Test Map' });
  mapId = map.id;
  const layer = await createLayer(mapId, ownerId, 'Layer One');
  await createFeature(layer!.id, ownerId, {
    geometry: { type: 'Point', coordinates: [1, 1] },
    properties: { title: 'A Pin', descriptionHtml: '', icon: 'marker', color: '#1976d2' },
  });

  agent = request.agent(app);
  await agent.post('/api/test/login').send({ userId: ownerId }).expect(204);
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('GET /api/maps/:mapId/export', () => {
  it('rejects unauthenticated requests with 401', async () => {
    await request(app).get(`/api/maps/${mapId}/export`).expect(401);
  });

  it('returns 404 for a map not owned by the requester', async () => {
    await agent.get('/api/maps/00000000-0000-0000-0000-000000000000/export').expect(404);
  });

  it('defaults to GeoJSON with the correct content type and filename', async () => {
    const res = await agent.get(`/api/maps/${mapId}/export`).expect(200);

    expect(res.headers['content-type']).toContain('application/geo+json');
    expect(res.headers['content-disposition']).toContain('export-route-test-map.geojson');
    expect(res.body.type).toBe('FeatureCollection');
    expect(res.body.features).toHaveLength(1);
  });

  it('exposes Content-Disposition via CORS so the client can read the filename cross-origin', async () => {
    // The client and server run on different origins/ports, so without
    // Access-Control-Expose-Headers the browser hides Content-Disposition
    // from JS even though the response includes it — supertest doesn't
    // simulate that restriction, so this specifically checks the response
    // header cors() is expected to add for a cross-origin request.
    const res = await agent.get(`/api/maps/${mapId}/export`).set('Origin', 'http://localhost:5173').expect(200);

    expect(res.headers['access-control-expose-headers']).toContain('Content-Disposition');
  });

  it('returns KML with the correct content type and filename when format=kml', async () => {
    const res = await agent.get(`/api/maps/${mapId}/export?format=kml`).expect(200);

    expect(res.headers['content-type']).toContain('application/vnd.google-earth.kml+xml');
    expect(res.headers['content-disposition']).toContain('export-route-test-map.kml');
    expect(res.text).toContain('<Folder><name>Layer One</name>');
    expect(res.text).toContain('<name>A Pin</name>');
  });

  it('returns a KMZ with the correct content type and filename when format=kmz', async () => {
    const res = await agent
      .get(`/api/maps/${mapId}/export?format=kmz`)
      .buffer()
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toContain('application/vnd.google-earth.kmz');
    expect(res.headers['content-disposition']).toContain('export-route-test-map.kmz');
    // Zip local-file-header magic bytes ("PK\x03\x04").
    expect((res.body as Buffer).subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('rejects an invalid format with 400', async () => {
    await agent.get(`/api/maps/${mapId}/export?format=shapefile`).expect(400);
  });
});
