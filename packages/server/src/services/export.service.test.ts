import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from './maps.service';
import { createLayer } from './layers.service';
import { createFeature } from './features.service';
import { buildGeoJsonExport, buildKmlExport } from './export.service';

let ownerId: string;
let mapId: string;
let trailsLayerId: string;
let poisLayerId: string;

const defaultProperties = { title: '', descriptionHtml: '', icon: 'marker', color: '#1976d2' };

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `export-service-test-${Date.now()}`,
      email: 'export-service-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Weekend Road Trip' });
  mapId = map.id;

  const trails = await createLayer(mapId, ownerId, 'Trails');
  const pois = await createLayer(mapId, ownerId, 'Points of Interest');
  trailsLayerId = trails!.id;
  poisLayerId = pois!.id;

  await createFeature(trailsLayerId, ownerId, {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.42, 37.77],
        [-122.41, 37.78],
      ],
    },
    properties: { ...defaultProperties, title: 'Coastal Trail', descriptionHtml: '<p>Scenic route</p>' },
  });

  await createFeature(poisLayerId, ownerId, {
    geometry: { type: 'Point', coordinates: [-122.4, 37.79] },
    properties: { ...defaultProperties, title: 'Lookout Point' },
  });
  await createFeature(poisLayerId, ownerId, {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-122.43, 37.76],
          [-122.42, 37.76],
          [-122.42, 37.77],
          [-122.43, 37.76],
        ],
      ],
    },
    properties: { ...defaultProperties, title: 'Picnic Area' },
  });
});

afterAll(async () => {
  // Deleting the user cascades through maps -> layers -> map_features.
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('buildGeoJsonExport', () => {
  it('returns null when the map is not owned by the requester', async () => {
    expect(await buildGeoJsonExport(mapId, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('assembles a FeatureCollection with every feature across every layer, tagged with its layer name', async () => {
    const result = await buildGeoJsonExport(mapId, ownerId);

    expect(result?.type).toBe('FeatureCollection');
    expect(result?.features).toHaveLength(3);

    const byTitle = new Map(result!.features.map((f) => [(f.properties as { title: string }).title, f]));

    const coastal = byTitle.get('Coastal Trail');
    expect(coastal?.geometry.type).toBe('LineString');
    expect((coastal?.properties as { layer: string }).layer).toBe('Trails');
    expect((coastal?.properties as { descriptionHtml: string }).descriptionHtml).toBe('<p>Scenic route</p>');

    const lookout = byTitle.get('Lookout Point');
    expect(lookout?.geometry.type).toBe('Point');
    expect((lookout?.properties as { layer: string }).layer).toBe('Points of Interest');

    const picnic = byTitle.get('Picnic Area');
    expect(picnic?.geometry.type).toBe('Polygon');
    expect((picnic?.properties as { layer: string }).layer).toBe('Points of Interest');
  });
});

describe('buildKmlExport', () => {
  it('returns null when the map is not owned by the requester', async () => {
    expect(await buildKmlExport(mapId, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('produces a Folder per layer, each containing that layer\'s Placemarks', async () => {
    const kml = await buildKmlExport(mapId, ownerId);

    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml).toContain('<Folder><name>Trails</name>');
    expect(kml).toContain('<Folder><name>Points of Interest</name>');

    // The Trails folder should contain exactly the Coastal Trail placemark,
    // and nothing from the Points of Interest layer. Layers export in
    // orderIndex order, and newer layers (Points of Interest, created after
    // Trails) sort first — see createLayer inserting at the top.
    const trailsFolderStart = kml!.indexOf('<Folder><name>Trails</name>');
    const poisFolderStart = kml!.indexOf('<Folder><name>Points of Interest</name>');
    const trailsFolder = kml!.slice(trailsFolderStart);

    expect(trailsFolder).toContain('<Placemark>');
    expect(trailsFolder).toContain('<name>Coastal Trail</name>');
    expect(trailsFolder).not.toContain('Lookout Point');
    expect(trailsFolder).not.toContain('Picnic Area');

    const poisFolder = kml!.slice(poisFolderStart, trailsFolderStart);
    expect(poisFolder).toContain('<name>Lookout Point</name>');
    expect(poisFolder).toContain('<name>Picnic Area</name>');
    expect((poisFolder.match(/<Placemark>/g) ?? []).length).toBe(2);
  });

  it('escapes the map title used as the KML document name', async () => {
    const specialMap = await createMap({ ownerId, title: 'Trip & <Notes>' });
    const kml = await buildKmlExport(specialMap.id, ownerId);

    expect(kml).toContain('<name>Trip &amp; &lt;Notes&gt;</name>');
  });
});
