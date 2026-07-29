import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from './maps.service';
import { createLayer, listLayersForMap } from './layers.service';
import { createFeature } from './features.service';
import { buildKmlExport } from './export.service';
import { listFeaturesForLayer } from './features.service';
import {
  ImportValidationError,
  importFeaturesAsNewLayer,
  importFeaturesAsNewMap,
  parseImportFile,
} from './import.service';

let ownerId: string;
let sourceMapId: string;

const defaultProperties = { title: '', descriptionHtml: '', icon: 'marker', color: '#1976d2' };

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `import-service-test-${Date.now()}`,
      email: 'import-service-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const sourceMap = await createMap({ ownerId, title: 'Source Map' });
  sourceMapId = sourceMap.id;
});

afterAll(async () => {
  // Deleting the user cascades through maps -> layers -> map_features.
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

describe('parseImportFile', () => {
  it('parses a valid GeoJSON FeatureCollection', () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 2] },
          properties: { title: 'Imported Point' },
        },
      ],
    });

    const result = parseImportFile('data.geojson', contents);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
  });

  it('parses a KML document into a FeatureCollection', () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Placemark><name>Test Pin</name><description>hi</description><Point><coordinates>1,2</coordinates></Point></Placemark>' +
      '</Document></kml>';

    const result = parseImportFile('data.kml', kml);
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties?.name).toBe('Test Pin');
  });

  it('rejects an unsupported file extension', () => {
    expect(() => parseImportFile('data.shp', 'whatever')).toThrow(ImportValidationError);
  });

  it('rejects invalid JSON with a clear error, not a crash', () => {
    expect(() => parseImportFile('data.geojson', '{not valid json')).toThrow(ImportValidationError);
  });

  it('rejects valid JSON that is not a FeatureCollection', () => {
    expect(() => parseImportFile('data.geojson', JSON.stringify({ hello: 'world' }))).toThrow(
      ImportValidationError,
    );
  });

  it('rejects a FeatureCollection containing an invalid geometry', () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1] }, properties: {} }],
    });
    expect(() => parseImportFile('data.geojson', contents)).toThrow(ImportValidationError);
  });
});

describe('importFeaturesAsNewLayer', () => {
  it('returns null when the target map is not owned by the requester', async () => {
    const result = await importFeaturesAsNewLayer(
      sourceMapId,
      '00000000-0000-0000-0000-000000000000',
      'Nope',
      { type: 'FeatureCollection', features: [] },
    );
    expect(result).toBeNull();
  });

  it('creates a new layer with a feature per FeatureCollection entry, mapping name/description', async () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [5, 5] },
          properties: { name: 'External Pin', description: 'from another tool' },
        },
      ],
    });
    const featureCollection = parseImportFile('external.geojson', contents);

    const result = await importFeaturesAsNewLayer(sourceMapId, ownerId, 'Imported Layer', featureCollection);
    expect(result?.layerName).toBe('Imported Layer');
    expect(result?.featureCount).toBe(1);

    const features = await listFeaturesForLayer(result!.layerId, ownerId);
    expect(features).toHaveLength(1);
    expect(features![0].properties.title).toBe('External Pin');
    expect(features![0].properties.descriptionHtml).toBe('from another tool');
  });

  it('sanitizes imported HTML descriptions', async () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [6, 6] },
          properties: { title: 'XSS Test', descriptionHtml: '<p>safe</p><script>alert(1)</script>' },
        },
      ],
    });
    const featureCollection = parseImportFile('external.geojson', contents);

    const result = await importFeaturesAsNewLayer(sourceMapId, ownerId, 'XSS Layer', featureCollection);
    const features = await listFeaturesForLayer(result!.layerId, ownerId);
    expect(features![0].properties.descriptionHtml).toBe('<p>safe</p>');
  });

  it('round-trips a KML export back through import, recreating an equivalent layer', async () => {
    // Uses its own isolated map/layer/features rather than the shared
    // sourceMapId fixture, since buildKmlExport exports every layer on a
    // map and earlier tests in this file add extra layers to sourceMapId.
    const roundTripMap = await createMap({ ownerId, title: 'Round Trip Source' });
    const roundTripLayer = await createLayer(roundTripMap.id, ownerId, 'Original Layer');
    await createFeature(roundTripLayer!.id, ownerId, {
      geometry: { type: 'Point', coordinates: [-122.4, 37.8] },
      properties: { ...defaultProperties, title: 'Lookout Point', descriptionHtml: '<p>Great view</p>' },
    });
    await createFeature(roundTripLayer!.id, ownerId, {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.42, 37.77],
          [-122.41, 37.78],
        ],
      },
      properties: { ...defaultProperties, title: 'Ridge Trail' },
    });

    const kml = await buildKmlExport(roundTripMap.id, ownerId);
    expect(kml).not.toBeNull();

    const featureCollection = parseImportFile('roundtrip.kml', kml!);

    const destinationMap = await createMap({ ownerId, title: 'Round Trip Destination' });
    const result = await importFeaturesAsNewLayer(
      destinationMap.id,
      ownerId,
      'Original Layer',
      featureCollection,
    );

    expect(result?.featureCount).toBe(2);

    const importedFeatures = await listFeaturesForLayer(result!.layerId, ownerId);
    const titles = importedFeatures!.map((f) => f.properties.title).sort();
    expect(titles).toEqual(['Lookout Point', 'Ridge Trail']);

    const lookout = importedFeatures!.find((f) => f.properties.title === 'Lookout Point');
    expect(lookout?.featureType).toBe('point');
    expect(lookout?.properties.descriptionHtml).toBe('<p>Great view</p>');

    const ridge = importedFeatures!.find((f) => f.properties.title === 'Ridge Trail');
    expect(ridge?.featureType).toBe('line');
  });

  it('never creates a layer when the input file is malformed', async () => {
    const map = await createMap({ ownerId, title: 'Malformed Import Target' });
    const before = await listLayersForMap(map.id, ownerId);
    expect(before).toHaveLength(0);

    // parseImportFile throws before importFeaturesAsNewLayer is ever called
    // (this is what the route handler relies on) — assert that directly,
    // then confirm the map still has no layers as a result.
    expect(() => parseImportFile('data.geojson', 'not json at all')).toThrow(ImportValidationError);

    const after = await listLayersForMap(map.id, ownerId);
    expect(after).toHaveLength(0);
  });
});

describe('importFeaturesAsNewMap', () => {
  it('creates a brand-new map, a layer, and its features', async () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [7, 7] },
          properties: { title: 'New Map Pin' },
        },
      ],
    });
    const featureCollection = parseImportFile('brand-new.geojson', contents);

    const result = await importFeaturesAsNewMap(ownerId, 'Brand New Map', 'brand-new', featureCollection);

    expect(result.mapId).toBeTruthy();
    expect(result.featureCount).toBe(1);

    const features = await listFeaturesForLayer(result.layerId, ownerId);
    expect(features![0].properties.title).toBe('New Map Pin');
  });
});
