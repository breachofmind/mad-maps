import {
  geometrySchema,
  geoJsonFeatureCollectionSchema,
  geometryToFeatureType,
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
