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

// Displayed in conventional lat, lng order even though GeoJSON positions are
// stored lng, lat. Six decimal places is sub-meter precision — plenty for
// display without implying more accuracy than the underlying data has.
export function formatCoordinates([lng, lat]: GeoJSON.Position): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

const FEET_PER_METER = 1 / 0.3048;
const METERS_PER_MILE = 1609.344;
const SQUARE_FEET_PER_SQUARE_METER = 1 / (0.3048 * 0.3048);
const SQUARE_METERS_PER_ACRE = 4046.8564224;
const SQUARE_METERS_PER_SQUARE_MILE = METERS_PER_MILE * METERS_PER_MILE;

export type DistanceUnit = 'meters' | 'kilometers' | 'feet' | 'miles';
export type AreaUnit = 'squareMeters' | 'squareKilometers' | 'squareFeet' | 'hectares' | 'acres' | 'squareMiles';

interface UnitOption<T extends string> {
  value: T;
  label: string;
  suffix: string;
  fromMeters: (value: number) => number;
}

export const DISTANCE_UNIT_OPTIONS: UnitOption<DistanceUnit>[] = [
  { value: 'meters', label: 'Meters', suffix: 'm', fromMeters: (m) => m },
  { value: 'kilometers', label: 'Kilometers', suffix: 'km', fromMeters: (m) => m / 1000 },
  { value: 'feet', label: 'Feet', suffix: 'ft', fromMeters: (m) => m * FEET_PER_METER },
  { value: 'miles', label: 'Miles', suffix: 'mi', fromMeters: (m) => m / METERS_PER_MILE },
];

export const AREA_UNIT_OPTIONS: UnitOption<AreaUnit>[] = [
  { value: 'squareMeters', label: 'Square meters', suffix: 'm²', fromMeters: (m) => m },
  { value: 'squareKilometers', label: 'Square kilometers', suffix: 'km²', fromMeters: (m) => m / 1_000_000 },
  { value: 'squareFeet', label: 'Square feet', suffix: 'ft²', fromMeters: (m) => m * SQUARE_FEET_PER_SQUARE_METER },
  { value: 'hectares', label: 'Hectares', suffix: 'ha', fromMeters: (m) => m / 10_000 },
  { value: 'acres', label: 'Acres', suffix: 'ac', fromMeters: (m) => m / SQUARE_METERS_PER_ACRE },
  { value: 'squareMiles', label: 'Square miles', suffix: 'mi²', fromMeters: (m) => m / SQUARE_METERS_PER_SQUARE_MILE },
];

// Units smaller than a kilometer/hectare read oddly with decimals (e.g.
// "482.00 ft"), so only the larger units get fractional precision.
const WHOLE_NUMBER_UNITS = new Set<DistanceUnit | AreaUnit>(['meters', 'feet', 'squareMeters', 'squareFeet']);

export function formatDistance(meters: number, unit: DistanceUnit): string {
  const option = DISTANCE_UNIT_OPTIONS.find((o) => o.value === unit)!;
  const value = option.fromMeters(meters);
  const maximumFractionDigits = WHOLE_NUMBER_UNITS.has(unit) ? 0 : 2;
  return `${value.toLocaleString(undefined, { maximumFractionDigits })} ${option.suffix}`;
}

export function formatArea(squareMeters: number, unit: AreaUnit): string {
  const option = AREA_UNIT_OPTIONS.find((o) => o.value === unit)!;
  const value = option.fromMeters(squareMeters);
  const maximumFractionDigits = WHOLE_NUMBER_UNITS.has(unit) ? 0 : 2;
  return `${value.toLocaleString(undefined, { maximumFractionDigits })} ${option.suffix}`;
}
