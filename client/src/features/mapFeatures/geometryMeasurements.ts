// Coordinates are lng/lat (WGS84), so measurements need geodesic math, not
// flat-plane distance — a straight Euclidean distance on raw degrees would
// be wildly wrong except right at the equator.

const EARTH_RADIUS_METERS = 6371008.8; // mean (authalic) Earth radius

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistanceMeters(a: GeoJSON.Position, b: GeoJSON.Position): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthMeters(coordinates: GeoJSON.Position[]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineDistanceMeters(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

// Spherical polygon area (Robert G. Chamberlain & William H. Duquette,
// NASA JPL) — the standard approximation used by most web mapping area
// tools; accurate enough for user-drawn shapes without needing a full
// ellipsoidal geodesic library.
function ringAreaMeters(ring: GeoJSON.Position[]): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    total += toRadians(lng2 - lng1) * (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

export function polygonAreaSquareMeters(rings: GeoJSON.Position[][]): number {
  const [outer, ...holes] = rings;
  if (!outer) return 0;
  return holes.reduce((area, hole) => area - ringAreaMeters(hole), ringAreaMeters(outer));
}

export function polygonPerimeterMeters(rings: GeoJSON.Position[][]): number {
  return rings.reduce((total, ring) => total + lineLengthMeters(ring), 0);
}

const FEET_PER_METER = 1 / 0.3048;
const METERS_PER_MILE = 1609.344;
const SQUARE_FEET_PER_SQUARE_METER = 1 / (0.3048 * 0.3048);
const SQUARE_METERS_PER_ACRE = 4046.8564224;
const SQUARE_METERS_PER_SQUARE_MILE = METERS_PER_MILE * METERS_PER_MILE;

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
}

export function formatDistanceImperial(meters: number): string {
  if (meters >= METERS_PER_MILE) {
    return `${(meters / METERS_PER_MILE).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi`;
  }
  return `${Math.round(meters * FEET_PER_METER).toLocaleString()} ft`;
}

export function formatArea(squareMeters: number): string {
  if (squareMeters >= 1_000_000) {
    return `${(squareMeters / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`;
  }
  return `${Math.round(squareMeters).toLocaleString()} m²`;
}

export function formatAreaImperial(squareMeters: number): string {
  if (squareMeters >= SQUARE_METERS_PER_SQUARE_MILE) {
    return `${(squareMeters / SQUARE_METERS_PER_SQUARE_MILE).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi²`;
  }
  if (squareMeters >= SQUARE_METERS_PER_ACRE) {
    return `${(squareMeters / SQUARE_METERS_PER_ACRE).toLocaleString(undefined, { maximumFractionDigits: 2 })} ac`;
  }
  return `${Math.round(squareMeters * SQUARE_FEET_PER_SQUARE_METER).toLocaleString()} ft²`;
}
