import { geometryAnchor } from '../geometryAnchor';

describe('geometryAnchor', () => {
  it('returns the coordinates directly for a Point', () => {
    expect(geometryAnchor({ type: 'Point', coordinates: [-122.4, 37.8] })).toEqual([-122.4, 37.8]);
  });

  it('returns the midpoint coordinate for an odd-length LineString', () => {
    const geometry: GeoJSON.Geometry = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    };
    expect(geometryAnchor(geometry)).toEqual([1, 1]);
  });

  it('averages the outer ring of a Polygon, excluding the closing duplicate point', () => {
    const geometry: GeoJSON.Geometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    };
    // Average of (0,0),(2,0),(2,2),(0,2) — the closing (0,0) must not be
    // double-counted, or the centroid would skew toward the origin.
    expect(geometryAnchor(geometry)).toEqual([1, 1]);
  });

  it('falls back to [0, 0] for geometry types outside our Point/LineString/Polygon domain', () => {
    const geometry: GeoJSON.Geometry = { type: 'MultiPoint', coordinates: [[1, 1]] };
    expect(geometryAnchor(geometry)).toEqual([0, 0]);
  });
});
