// Bounding box covering every coordinate in a feature's geometry, for
// map.fitBounds() — as opposed to geometryAnchor's single representative
// point, this lets the map frame the whole shape rather than just center on
// part of it.
export function geometryBounds(geometry: GeoJSON.Geometry): [[number, number], [number, number]] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function visit(coordinates: unknown): void {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number') {
      const [lng, lat] = coordinates as [number, number];
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      return;
    }
    coordinates.forEach(visit);
  }

  // MapFeatureDTO's featureType only ever produces Point/LineString/Polygon,
  // all of which expose a plain (possibly nested) coordinates array.
  visit((geometry as GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon).coordinates);

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
