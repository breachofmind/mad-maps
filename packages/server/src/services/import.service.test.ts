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
  parseImportFileGroups,
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

  it('strips a Z coordinate from GeoJSON geometries', () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [1, 2, 100] },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [1, 2, 100],
              [3, 4, 200],
            ],
          },
          properties: {},
        },
      ],
    });

    const result = parseImportFile('data.geojson', contents);
    expect(result.features[0].geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
    expect(result.features[1].geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [1, 2],
        [3, 4],
      ],
    });
  });

  it('strips altitude from a KML Point so it can be stored in the 2D geometry column', () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Placemark><name>Camp</name><Point><coordinates>1,2,150</coordinates></Point></Placemark>' +
      '</Document></kml>';

    const result = parseImportFile('data.kml', kml);
    expect(result.features[0].geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
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

describe('parseImportFileGroups', () => {
  it('returns a single ungrouped group for a flat (folder-less) KML document', () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Placemark><name>Test Pin</name><Point><coordinates>1,2</coordinates></Point></Placemark>' +
      '</Document></kml>';

    const groups = parseImportFileGroups('data.kml', kml);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBeNull();
    expect(groups[0].featureCollection.features).toHaveLength(1);
  });

  it('returns a single ungrouped group for GeoJSON, which has no folder concept', () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} }],
    });

    const groups = parseImportFileGroups('data.geojson', contents);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBeNull();
  });

  it('splits a KML document with Folders into one group per top-level Folder', () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Folder><name>Eat</name>' +
      '<Placemark><name>Cafe</name><Point><coordinates>1,1</coordinates></Point></Placemark>' +
      '</Folder>' +
      '<Folder><name>Camp</name>' +
      '<Placemark><name>Site A</name><Point><coordinates>2,2</coordinates></Point></Placemark>' +
      '<Placemark><name>Site B</name><Point><coordinates>3,3</coordinates></Point></Placemark>' +
      '</Folder>' +
      '</Document></kml>';

    const groups = parseImportFileGroups('data.kml', kml);
    expect(groups.map((g) => g.name)).toEqual(['Eat', 'Camp']);
    expect(groups[0].featureCollection.features).toHaveLength(1);
    expect(groups[1].featureCollection.features).toHaveLength(2);
  });

  it('rolls a nested subfolder into its parent top-level Folder', () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Folder><name>Trip</name>' +
      '<Placemark><name>Top level pin</name><Point><coordinates>1,1</coordinates></Point></Placemark>' +
      '<Folder><name>Nested</name>' +
      '<Placemark><name>Nested pin</name><Point><coordinates>2,2</coordinates></Point></Placemark>' +
      '</Folder>' +
      '</Folder>' +
      '</Document></kml>';

    const groups = parseImportFileGroups('data.kml', kml);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Trip');
    expect(groups[0].featureCollection.features).toHaveLength(2);
  });

  it('buckets root-level loose Placemarks separately from named Folders', () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Placemark><name>Loose pin</name><Point><coordinates>1,1</coordinates></Point></Placemark>' +
      '<Folder><name>Eat</name>' +
      '<Placemark><name>Cafe</name><Point><coordinates>2,2</coordinates></Point></Placemark>' +
      '</Folder>' +
      '</Document></kml>';

    const groups = parseImportFileGroups('data.kml', kml);
    expect(groups.map((g) => g.name)).toEqual(['Eat', null]);
  });
});

describe('importFeaturesAsNewLayer', () => {
  it('returns null when the target map is not owned by the requester', async () => {
    const result = await importFeaturesAsNewLayer(sourceMapId, '00000000-0000-0000-0000-000000000000', 'Nope', [
      { name: null, featureCollection: { type: 'FeatureCollection', features: [] } },
    ]);
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
    const groups = parseImportFileGroups('external.geojson', contents);

    const result = await importFeaturesAsNewLayer(sourceMapId, ownerId, 'Imported Layer', groups);
    expect(result?.layers).toHaveLength(1);
    expect(result?.layers[0].layerName).toBe('Imported Layer');
    expect(result?.featureCount).toBe(1);

    const features = await listFeaturesForLayer(result!.layers[0].layerId, ownerId);
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
    const groups = parseImportFileGroups('external.geojson', contents);

    const result = await importFeaturesAsNewLayer(sourceMapId, ownerId, 'XSS Layer', groups);
    const features = await listFeaturesForLayer(result!.layers[0].layerId, ownerId);
    expect(features![0].properties.descriptionHtml).toBe('<p>safe</p>');
  });

  it('picks up a pin/line color from GeoJSON simplestyle properties', async () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [8, 8] },
          properties: { title: 'Colored Pin', 'marker-color': '#fbc02d' },
        },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [8, 8],
              [9, 9],
            ],
          },
          properties: { title: 'Colored Line', stroke: '#1267ff' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [10, 10] },
          properties: { title: 'Default Pin' },
        },
      ],
    });
    const groups = parseImportFileGroups('colors.geojson', contents);

    const result = await importFeaturesAsNewLayer(sourceMapId, ownerId, 'Color Layer', groups);
    const features = await listFeaturesForLayer(result!.layers[0].layerId, ownerId);

    expect(features!.find((f) => f.properties.title === 'Colored Pin')?.properties.color).toBe('#fbc02d');
    expect(features!.find((f) => f.properties.title === 'Colored Line')?.properties.color).toBe('#1267ff');
    expect(features!.find((f) => f.properties.title === 'Default Pin')?.properties.color).toBe('#1976d2');
  });

  it('ignores a malformed color value and falls back to the default', async () => {
    const contents = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [11, 11] },
          properties: { title: 'Bad Color Pin', 'marker-color': 'not-a-color' },
        },
      ],
    });
    const groups = parseImportFileGroups('bad-color.geojson', contents);

    const result = await importFeaturesAsNewLayer(sourceMapId, ownerId, 'Bad Color Layer', groups);
    const features = await listFeaturesForLayer(result!.layers[0].layerId, ownerId);
    expect(features![0].properties.color).toBe('#1976d2');
  });

  it('imports a KML with Folders as one layer per Folder, wiring up each pin color', async () => {
    const kml =
      '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
      '<Style id="yellow"><IconStyle><color>ff2dc0fb</color><Icon><href>x.png</href></Icon></IconStyle></Style>' +
      '<Folder><name>Eat</name>' +
      '<Placemark><name>Cafe</name><styleUrl>#yellow</styleUrl><Point><coordinates>1,1</coordinates></Point></Placemark>' +
      '</Folder>' +
      '<Folder><name>Camp</name>' +
      '<Placemark><name>Site A</name><Point><coordinates>2,2</coordinates></Point></Placemark>' +
      '<Placemark><name>Site B</name><Point><coordinates>3,3</coordinates></Point></Placemark>' +
      '</Folder>' +
      '</Document></kml>';

    const groups = parseImportFileGroups('grouped.kml', kml);
    const map = await createMap({ ownerId, title: 'Grouped Import Map' });
    const result = await importFeaturesAsNewLayer(map.id, ownerId, 'grouped', groups);

    expect(result?.layers.map((l) => l.layerName)).toEqual(['Eat', 'Camp']);
    expect(result?.layers.map((l) => l.featureCount)).toEqual([1, 2]);
    expect(result?.featureCount).toBe(3);

    const eatFeatures = await listFeaturesForLayer(result!.layers[0].layerId, ownerId);
    // togeojson normalizes the KML ABGR <color> (ff2dc0fb) to RGB #fbc02d.
    expect(eatFeatures![0].properties.color).toBe('#fbc02d');
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

    const groups = parseImportFileGroups('roundtrip.kml', kml!);

    const destinationMap = await createMap({ ownerId, title: 'Round Trip Destination' });
    const result = await importFeaturesAsNewLayer(destinationMap.id, ownerId, 'Original Layer', groups);

    expect(result?.featureCount).toBe(2);
    // Our own KML export wraps each layer's features in a Folder named after
    // the layer, so the round trip recreates a single layer named the same.
    expect(result?.layers).toHaveLength(1);
    expect(result?.layers[0].layerName).toBe('Original Layer');

    const importedFeatures = await listFeaturesForLayer(result!.layers[0].layerId, ownerId);
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

    // parseImportFileGroups throws before importFeaturesAsNewLayer is ever
    // called (this is what the route handler relies on) — assert that
    // directly, then confirm the map still has no layers as a result.
    expect(() => parseImportFileGroups('data.geojson', 'not json at all')).toThrow(ImportValidationError);

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
    const groups = parseImportFileGroups('brand-new.geojson', contents);

    const result = await importFeaturesAsNewMap(ownerId, 'Brand New Map', 'brand-new', groups);

    expect(result.mapId).toBeTruthy();
    expect(result.featureCount).toBe(1);

    const features = await listFeaturesForLayer(result.layers[0].layerId, ownerId);
    expect(features![0].properties.title).toBe('New Map Pin');
  });
});
