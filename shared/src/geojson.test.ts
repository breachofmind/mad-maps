import {
  geometrySchema,
  geoJsonFeatureCollectionSchema,
  geometryToFeatureType,
  externalGeoJsonFeatureCollectionSchema,
} from './geojson';

describe('geometrySchema', () => {
  it('accepts a valid Point', () => {
    const result = geometrySchema.safeParse({ type: 'Point', coordinates: [-122.4, 37.8] });
    expect(result.success).toBe(true);
  });

  it('accepts a valid Polygon (closed ring)', () => {
    const result = geometrySchema.safeParse({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a Polygon ring with fewer than 4 positions', () => {
    const result = geometrySchema.safeParse({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [0, 0],
        ],
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown geometry type', () => {
    const result = geometrySchema.safeParse({ type: 'MultiPoint', coordinates: [] });
    expect(result.success).toBe(false);
  });
});

describe('geometryToFeatureType', () => {
  it('maps Point -> point, LineString -> line, Polygon -> polygon', () => {
    expect(geometryToFeatureType({ type: 'Point', coordinates: [0, 0] })).toBe('point');
    expect(
      geometryToFeatureType({
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
    ).toBe('line');
    expect(
      geometryToFeatureType({
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    ).toBe('polygon');
  });
});

describe('geoJsonFeatureCollectionSchema', () => {
  it('accepts a well-formed FeatureCollection', () => {
    const result = geoJsonFeatureCollectionSchema.safeParse({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { title: 'Home' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('externalGeoJsonFeatureCollectionSchema', () => {
  it('accepts Multi* geometries, unlike the strict local geometrySchema', () => {
    const result = externalGeoJsonFeatureCollectionSchema.safeParse({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            ],
          },
          properties: { IncidentName: 'Test Fire' },
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(geometrySchema.safeParse(result.success ? result.data.features[0].geometry : null).success).toBe(false);
  });

  it('accepts arbitrary/missing properties, unlike the strict local schema', () => {
    const result = externalGeoJsonFeatureCollectionSchema.safeParse({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: null }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a GeometryCollection', () => {
    const result = externalGeoJsonFeatureCollectionSchema.safeParse({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'GeometryCollection', geometries: [] },
          properties: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a FeatureCollection with more than the max allowed features', () => {
    const tooMany = Array.from({ length: 20_001 }, () => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
      properties: {},
    }));
    const result = externalGeoJsonFeatureCollectionSchema.safeParse({
      type: 'FeatureCollection',
      features: tooMany,
    });
    expect(result.success).toBe(false);
  });
});
