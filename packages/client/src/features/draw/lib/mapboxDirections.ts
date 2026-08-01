export type RouteProfile = 'walking' | 'cycling' | 'driving';

export interface DirectionsRoute {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
}

// Mapbox's public access token (already exposed to the client for map
// rendering) is also valid for its REST APIs, so this calls Directions
// directly from the browser rather than proxying through the server. The
// token is passed in (rather than read from the mapboxgl singleton here)
// so this stays a plain, unit-testable function with no dependency on the
// mapbox-gl runtime.
export async function fetchDirectionsRoute(
  waypoints: [number, number][],
  profile: RouteProfile,
  accessToken: string,
): Promise<DirectionsRoute> {
  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Directions request failed (${response.status})`);
  }
  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) {
    throw new Error('No route found between those points');
  }
  return {
    geometry: route.geometry as GeoJSON.LineString,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
