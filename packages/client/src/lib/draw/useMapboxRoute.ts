import { useEffect, useRef, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import { mapboxgl as mapboxglRuntime } from '../map/mapbox';
import { FEATURE_POINT_LAYER_ID } from '../map/featureLayerIds';
import { fetchDirectionsRoute, type RouteProfile } from './mapboxDirections';
import { DASH_LENGTH, GAP_LENGTH } from './drawTheme';
import { usePulseOpacity } from './usePulseOpacity';

const SOURCE_ID = 'mad-maps-route-preview';
// Dashed line straight between the clicked waypoints (and out to the live
// cursor), in click order — shown the whole time so the user can always see
// where they've placed nodes, even before/if the snapped route comes back.
const WAYPOINT_LINE_LAYER_ID = 'mad-maps-route-preview-waypoint-line';
const ROUTE_LINE_LAYER_ID = 'mad-maps-route-preview-route-line';
const POINT_LAYER_ID = 'mad-maps-route-preview-points';

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

interface UseMapboxRouteOptions {
  map: mapboxgl.Map | null;
  active: boolean;
  profile: RouteProfile;
  onCreate: (feature: GeoJSON.Feature) => void;
}

// Lets a user build a route by clicking waypoints instead of drawing every
// vertex by hand: after each click, the waypoints are sent to the Mapbox
// Directions API and the response (snapped to the road/path network) is
// shown as a preview until the user finishes the route.
export function useMapboxRoute({ map, active, profile, onCreate }: UseMapboxRouteOptions) {
  const waypointsRef = useRef<[number, number][]>([]);
  const routeRef = useRef<GeoJSON.LineString | null>(null);
  const cursorRef = useRef<[number, number] | null>(null);
  const requestSeqRef = useRef(0);
  const [waypointCount, setWaypointCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    if (!map) return;

    function ensureLayers() {
      if (!map || map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, { type: 'geojson', data: EMPTY_COLLECTION });
      // Color/width/dasharray match the line tool's own in-progress dash
      // style (drawTheme.ts's 'gl-draw-lines' active case, which has no
      // halo either) so both drawing tools read as the same visual language.
      map.addLayer({
        id: WAYPOINT_LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'role'], 'waypointLine'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#fbb03b',
          'line-width': 2,
          'line-dasharray': [DASH_LENGTH, GAP_LENGTH],
          'line-opacity': 1,
        },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', ['get', 'role'], 'route'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#3bb2d0', 'line-width': 4, 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: POINT_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', ['get', 'role'], 'waypointPoint'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#fff',
          'circle-stroke-color': '#fbb03b',
          'circle-stroke-width': 3,
        },
      });
    }

    // Added unconditionally (not gated on map.isStyleLoaded()) — that check
    // can be transiently false here since sibling hooks (FeatureLayer,
    // useMapboxDraw) add their own sources/layers in this same render
    // batch, marking the style briefly dirty. The map is only ever handed
    // to this hook after MapView's 'load' event, so the base style is
    // already parsed and safe to add to. The 'style.load' listener below is
    // solely for re-adding these layers after a *later* base-layer switch,
    // which wipes all runtime-added layers/sources — mirrors
    // FeatureLayer.tsx's ensureLayersAdded/handleStyleLoad split.
    ensureLayers();
    map.on('style.load', ensureLayers);
    return () => {
      map.off('style.load', ensureLayers);
      if (map.getLayer(WAYPOINT_LINE_LAYER_ID)) map.removeLayer(WAYPOINT_LINE_LAYER_ID);
      if (map.getLayer(ROUTE_LINE_LAYER_ID)) map.removeLayer(ROUTE_LINE_LAYER_ID);
      if (map.getLayer(POINT_LAYER_ID)) map.removeLayer(POINT_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  usePulseOpacity(map, active, WAYPOINT_LINE_LAYER_ID);

  function render() {
    const source = map?.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    const features: GeoJSON.Feature[] = waypointsRef.current.map((coordinates) => ({
      type: 'Feature',
      properties: { role: 'waypointPoint' },
      geometry: { type: 'Point', coordinates },
    }));
    // Rubber-bands from the last placed waypoint to the live cursor position,
    // like mapbox-gl-draw's own line modes, so there's visible feedback as
    // soon as a single point is placed rather than only after the second.
    const lineCoordinates =
      cursorRef.current && waypointsRef.current.length >= 1
        ? [...waypointsRef.current, cursorRef.current]
        : waypointsRef.current;
    if (lineCoordinates.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { role: 'waypointLine' },
        geometry: { type: 'LineString', coordinates: lineCoordinates },
      });
    }
    if (routeRef.current) {
      features.push({ type: 'Feature', properties: { role: 'route' }, geometry: routeRef.current });
    }
    source.setData({ type: 'FeatureCollection', features });
  }

  async function refetch() {
    if (waypointsRef.current.length < 2) {
      routeRef.current = null;
      setDistanceMeters(null);
      setDurationSeconds(null);
      render();
      return;
    }
    const seq = ++requestSeqRef.current;
    setIsFetching(true);
    setError(null);
    try {
      const route = await fetchDirectionsRoute(
        waypointsRef.current,
        profileRef.current,
        mapboxglRuntime.accessToken ?? '',
      );
      if (seq !== requestSeqRef.current) return;
      routeRef.current = route.geometry;
      setDistanceMeters(route.distanceMeters);
      setDurationSeconds(route.durationSeconds);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      routeRef.current = null;
      setDistanceMeters(null);
      setDurationSeconds(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch route');
    } finally {
      if (seq === requestSeqRef.current) setIsFetching(false);
      render();
    }
  }

  function reset() {
    waypointsRef.current = [];
    routeRef.current = null;
    cursorRef.current = null;
    requestSeqRef.current += 1;
    setWaypointCount(0);
    setIsFetching(false);
    setDistanceMeters(null);
    setDurationSeconds(null);
    setError(null);
    render();
  }

  function finish() {
    if (waypointsRef.current.length < 2) {
      reset();
      return;
    }
    const geometry: GeoJSON.LineString = routeRef.current ?? {
      type: 'LineString',
      coordinates: waypointsRef.current,
    };
    // distanceMeters/durationSeconds reflect the last successfully snapped
    // route (null if the fetch never completed/failed) — passed through on
    // the feature so the caller can prefill a description without this hook
    // needing to know anything about how that gets displayed or persisted.
    onCreateRef.current({
      type: 'Feature',
      properties: { distanceMeters, durationSeconds, profile: profileRef.current },
      geometry,
    });
    reset();
  }

  function undoLast() {
    if (waypointsRef.current.length === 0) return;
    waypointsRef.current = waypointsRef.current.slice(0, -1);
    setWaypointCount(waypointsRef.current.length);
    void refetch();
  }

  // Clear the in-progress route whenever the tool is switched off.
  useEffect(() => {
    if (!active) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Re-run the snap when the user changes profile (e.g. walking -> driving)
  // partway through an in-progress route.
  useEffect(() => {
    if (active && waypointsRef.current.length >= 2) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!map || !active) return;

    // Clicking directly on an existing pin uses its exact coordinates as the
    // waypoint instead of the raw click position, so routes connect cleanly
    // to features already on the map rather than landing a few meters off.
    function snappedClickCoordinates(e: mapboxgl.MapMouseEvent): [number, number] {
      if (!map || !map.getLayer(FEATURE_POINT_LAYER_ID)) return [e.lngLat.lng, e.lngLat.lat];
      const [hit] = map.queryRenderedFeatures(e.point, { layers: [FEATURE_POINT_LAYER_ID] });
      if (hit?.geometry.type === 'Point') return hit.geometry.coordinates as [number, number];
      return [e.lngLat.lng, e.lngLat.lat];
    }

    function handleClick(e: mapboxgl.MapMouseEvent) {
      waypointsRef.current = [...waypointsRef.current, snappedClickCoordinates(e)];
      setWaypointCount(waypointsRef.current.length);
      render();
      void refetch();
    }

    function handleMouseMove(e: mapboxgl.MapMouseEvent) {
      cursorRef.current = [e.lngLat.lng, e.lngLat.lat];
      render();
    }

    function handleMouseOut() {
      cursorRef.current = null;
      render();
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        reset();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        finish();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        undoLast();
      }
    }

    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, active]);

  return { waypointCount, isFetching, distanceMeters, durationSeconds, error, finish, cancel: reset, undoLast };
}
