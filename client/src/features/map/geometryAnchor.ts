export function geometryAnchor(geometry: GeoJSON.Geometry): [number, number] {
  if (geometry.type === 'Point') {
    return geometry.coordinates as [number, number];
  }
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates;
    return coords[Math.floor(coords.length / 2)] as [number, number];
  }
  if (geometry.type === 'Polygon') {
    // Average the outer ring, excluding the closing duplicate point.
    const ring = geometry.coordinates[0].slice(0, -1);
    const [sumLng, sumLat] = ring.reduce<[number, number]>(
      (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat],
      [0, 0],
    );
    return [sumLng / ring.length, sumLat / ring.length];
  }
  // MapFeatureDTO's featureType only ever produces Point/LineString/Polygon;
  // this branch exists purely so geometryAnchor is total over GeoJSON.Geometry.
  return [0, 0];
}
