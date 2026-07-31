import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, LineStyle, MapFeatureDTO } from '@mapinski/shared';
import { useEditorStore } from '../../state/editorStore';
import { featuresQueryKey, fetchFeatures, updateFeature } from '../mapFeatures/api';
import { ensureFeatureIconImages, featureIconImageId, type FeatureIconRef } from './featureIconImages';
import { DEFAULT_HIGHLIGHT_COLOR, sampleBasemapHighlightColor } from './basemapContrast';

const SOURCE_ID = 'mapinski-features';
const LAYER_IDS = {
  polygonFill: 'mapinski-features-polygon-fill',
  polygonOutline: 'mapinski-features-polygon-outline',
  line: 'mapinski-features-line',
  lineHitArea: 'mapinski-features-line-hit-area',
  point: 'mapinski-features-point',
  pointHover: 'mapinski-features-point-hover',
  geometryHover: 'mapinski-features-geometry-hover',
};
// Click/hover hit-testing uses the invisible, much-wider lineHitArea layer
// instead of the visible line layer, since a thin rendered line is a hard
// target to click precisely — see lineHitArea's paint below.
const CLICKABLE_LAYER_IDS = [LAYER_IDS.polygonFill, LAYER_IDS.lineHitArea, LAYER_IDS.point];
const POINT_ICON_SIZE = 0.4;
const POINT_HOVER_RADIUS = 18;
const POINT_HOVER_STROKE_WIDTH = 5;
const GEOMETRY_HOVER_WIDTH = 11;
// Placeholder used only until the contrast-sampling effect below picks a
// color for the actual rendered basemap (see applyContrastColor).
const DEFAULT_HOVER_COLOR = DEFAULT_HIGHLIGHT_COLOR;
const POINT_HOVER_OPACITY = 0.3;
const DEFAULT_STROKE_WIDTH = 3;
const LINE_HIT_AREA_PADDING = 18;
const HIGHLIGHT_FADE_DURATION_MS = 200;
// mapbox-gl-draw registers each theme layer under both a "hot" (actively
// changing) and "cold" (static) source, appending that suffix to the style
// id — see drawTheme.ts / mapbox-gl-draw's options.js addSources(). These
// are the vertex-handle layers from that theme, queried below so hovering a
// control point can get a real pointer cursor: Draw's own CSS for this
// (`.feature-vertex.mouse-move`) references a `feature-vertex` class that,
// in the installed version, no mode ever actually applies — so it never
// matches, and the effective cursor otherwise falls back to a generic
// "move" state that only kicks in after a vertex has been dragged once.
const DRAW_VERTEX_LAYER_IDS = ['gl-draw-vertex-inner.hot', 'gl-draw-vertex-inner.cold'];

// mapbox's line-dasharray only accepts a fixed array per-feature (no
// omitting it for "solid"), so a solid line is represented as one long dash
// with no gap — the standard workaround for mixing dash styles within a
// single data-driven layer.
const LINE_DASH_ARRAYS: Record<LineStyle, number[]> = {
  solid: [1, 0],
  dashed: [3, 2],
  dotted: [0, 2],
};

// getCanvas() returns undefined once the map has been map.remove()'d, which
// can happen before this component's own effect cleanup runs (MapView, a
// sibling, removes the map on unmount, and React doesn't guarantee cleanup
// order across sibling components) — guard every cursor update against that.
function setMapCursor(map: mapboxgl.Map, cursor: string) {
  const canvas = map.getCanvas();
  if (canvas) canvas.style.cursor = cursor;
}

function highlightFilter(featureIds: string[], geometryTypes: string[]): mapboxgl.FilterSpecification {
  return [
    'all',
    ['in', ['geometry-type'], ['literal', geometryTypes]],
    ['in', ['get', 'featureId'], ['literal', featureIds]],
  ];
}

// pointHover doubles as the selected-pin ring, and geometryHover doubles as
// the selected line/polygon border: both get the same contrast-aware
// highlight color (see applyContrastColor) for a hovered feature and a
// selected one, driven off whichever feature ids are hovered and/or
// currently selected. (While a line/polygon is being vertex-edited it's
// excluded from this layer's data entirely — see buildFeatureCollection's
// editingFeatureId check — so there's nothing here to highlight in that
// case; mapbox-gl-draw renders its own overlay.)
//
// Membership (which features these layers render) is still filter-based —
// mapbox-gl-js's *-transition paint properties don't reliably animate when
// driven by feature-state (confirmed open bug, mapbox/mapbox-gl-js#12685;
// Mapbox's own official transition example uses setPaintProperty directly,
// never feature-state). So the fade is done at the *layer* level instead:
// opacity toggles between 0 and its visible value via setPaintProperty
// whenever highlighted-ness flips between "nothing" and "something", which
// *is* a supported, reliably-animating combination. The one tradeoff is that
// swapping the highlight directly from one feature to another (both already
// highlighted) won't itself fade, since the opacity value doesn't change —
// only entering/leaving the "nothing highlighted" state does.
function applyHighlight(map: mapboxgl.Map, hoveredFeatureId: string | null, selectedFeatureId: string | null) {
  const highlightedIds = [hoveredFeatureId, selectedFeatureId].filter((id): id is string => id !== null);
  const visible = highlightedIds.length > 0;
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setFilter(LAYER_IDS.pointHover, highlightFilter(highlightedIds, ['Point']));
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-opacity', visible ? POINT_HOVER_OPACITY : 0);
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-stroke-opacity', visible ? 1 : 0);
  }
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setFilter(LAYER_IDS.geometryHover, highlightFilter(highlightedIds, ['LineString', 'Polygon']));
    map.setPaintProperty(LAYER_IDS.geometryHover, 'line-opacity', visible ? 1 : 0);
  }
}

interface FeatureLayerProps {
  map: mapboxgl.Map | null;
  layers: LayerDTO[];
  // Excluded from this layer's own rendering while its vertices are being
  // edited via mapbox-gl-draw's direct_select mode, which draws its own
  // overlay for it — without this it would render twice.
  editingFeatureId?: string | null;
}

function buildFeatureCollection(
  layers: LayerDTO[],
  featuresByLayer: Map<string, MapFeatureDTO[]>,
  editingFeatureId: string | null,
): { collection: GeoJSON.FeatureCollection; iconRefs: FeatureIconRef[] } {
  const features: GeoJSON.Feature[] = [];
  const iconRefs: FeatureIconRef[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const feature of featuresByLayer.get(layer.id) ?? []) {
      if (feature.id === editingFeatureId) continue;
      const color = feature.properties.color || layer.color;
      const icon = feature.properties.icon || 'marker';
      iconRefs.push({ icon, color });
      features.push({
        type: 'Feature',
        id: feature.id,
        geometry: feature.geometry,
        properties: {
          featureId: feature.id,
          layerId: layer.id,
          color,
          title: feature.properties.title,
          icon: featureIconImageId(icon, color),
          strokeWidth: feature.properties.strokeWidth ?? DEFAULT_STROKE_WIDTH,
          dashArray: LINE_DASH_ARRAYS[feature.properties.lineStyle ?? 'solid'],
        },
      });
    }
  }
  return { collection: { type: 'FeatureCollection', features }, iconRefs };
}

function ensureLayersAdded(map: mapboxgl.Map, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(SOURCE_ID, { type: 'geojson', data });
  map.addLayer({
    id: LAYER_IDS.polygonFill,
    type: 'fill',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
  });
  map.addLayer({
    id: LAYER_IDS.polygonOutline,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'strokeWidth'],
      'line-dasharray': ['get', 'dashArray'],
    },
  });
  // Inserted before polygonOutline (i.e. between it and polygonFill) so it
  // renders underneath both the polygon outline and the line layer (added
  // next), giving hovered LineStrings/Polygons a soft white glow behind
  // their crisp edge.
  map.addLayer(
    {
      id: LAYER_IDS.geometryHover,
      type: 'line',
      source: SOURCE_ID,
      filter: highlightFilter([], ['LineString', 'Polygon']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': DEFAULT_HOVER_COLOR,
        'line-width': GEOMETRY_HOVER_WIDTH,
        'line-opacity': 0,
        'line-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
      },
    },
    LAYER_IDS.polygonOutline,
  );
  map.addLayer({
    id: LAYER_IDS.line,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'strokeWidth'],
      'line-dasharray': ['get', 'dashArray'],
    },
  });
  // Invisible, much wider than the visible line — see CLICKABLE_LAYER_IDS.
  map.addLayer({
    id: LAYER_IDS.lineHitArea,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ['+', ['get', 'strokeWidth'], LINE_HIT_AREA_PADDING],
      'line-opacity': 0,
    },
  });
  map.addLayer({
    id: LAYER_IDS.point,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': POINT_ICON_SIZE,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: LAYER_IDS.pointHover,
    type: 'circle',
    source: SOURCE_ID,
    filter: highlightFilter([], ['Point']),
    paint: {
      'circle-radius': POINT_HOVER_RADIUS,
      'circle-color': DEFAULT_HOVER_COLOR,
      'circle-opacity': 0,
      'circle-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
      'circle-stroke-width': POINT_HOVER_STROKE_WIDTH,
      'circle-stroke-color': DEFAULT_HOVER_COLOR,
      'circle-stroke-opacity': 0,
      'circle-stroke-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
    },
  });
}

interface PointDragState {
  featureId: string;
  layerId: string;
  moved: boolean;
}

export function FeatureLayer({ map, layers, editingFeatureId = null }: FeatureLayerProps) {
  const queryClient = useQueryClient();
  const setSelection = useEditorStore((s) => s.setSelection);
  const hoveredFeatureId = useEditorStore((s) => s.hoveredFeatureId);
  const setHoveredFeatureId = useEditorStore((s) => s.setHoveredFeatureId);
  const selectedFeatureId = useEditorStore((s) => s.selection?.featureId ?? null);
  const dragStateRef = useRef<PointDragState | null>(null);

  const moveFeatureMutation = useMutation({
    mutationFn: ({ featureId, lng, lat }: { featureId: string; layerId: string; lng: number; lat: number }) =>
      updateFeature(featureId, { geometry: { type: 'Point', coordinates: [lng, lat] } }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(vars.layerId) });
    },
  });

  const featureQueries = useQueries({
    queries: layers.map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
    })),
  });

  const { data, iconRefs } = useMemo(() => {
    const featuresByLayer = new Map<string, MapFeatureDTO[]>();
    layers.forEach((layer, index) => {
      featuresByLayer.set(layer.id, featureQueries[index]?.data ?? []);
    });
    const { collection, iconRefs } = buildFeatureCollection(layers, featuresByLayer, editingFeatureId);
    return { data: collection, iconRefs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, editingFeatureId, featureQueries.map((q) => q.dataUpdatedAt).join(',')]);

  const dataRef = useRef(data);
  dataRef.current = data;
  const iconRefsRef = useRef(iconRefs);
  iconRefsRef.current = iconRefs;
  const hoveredFeatureIdRef = useRef(hoveredFeatureId);
  hoveredFeatureIdRef.current = hoveredFeatureId;
  const selectedFeatureIdRef = useRef(selectedFeatureId);
  selectedFeatureIdRef.current = selectedFeatureId;
  const moveFeatureMutationRef = useRef(moveFeatureMutation);
  moveFeatureMutationRef.current = moveFeatureMutation;
  const editingFeatureIdRef = useRef(editingFeatureId);
  editingFeatureIdRef.current = editingFeatureId;

  useEffect(() => {
    if (!map) return;
    applyHighlight(map, hoveredFeatureId, selectedFeatureId);
  }, [map, hoveredFeatureId, selectedFeatureId]);

  useEffect(() => {
    if (!map) return;

    function applyContrastColor() {
      if (!map) return;
      const color = sampleBasemapHighlightColor(map);
      if (map.getLayer(LAYER_IDS.geometryHover)) {
        map.setPaintProperty(LAYER_IDS.geometryHover, 'line-color', color);
      }
      if (map.getLayer(LAYER_IDS.pointHover)) {
        map.setPaintProperty(LAYER_IDS.pointHover, 'circle-color', color);
        map.setPaintProperty(LAYER_IDS.pointHover, 'circle-stroke-color', color);
      }
    }

    // A style's tiles aren't guaranteed to be rendered the instant
    // 'style.load' fires, so wait for the map to actually go idle (nothing
    // left to load) before sampling it for a contrasting highlight color.
    // Re-run on every basemap switch, not just the initial style.
    function scheduleContrastUpdate() {
      map?.once('idle', applyContrastColor);
    }

    scheduleContrastUpdate();
    map.on('style.load', scheduleContrastUpdate);

    return () => {
      map.off('style.load', scheduleContrastUpdate);
    };
  }, [map]);

  useEffect(() => {
    // Clear any cursor we set ourselves right as editing starts, so Draw's
    // own CSS-driven cursor (see handleMouseMove's early return below) takes
    // over cleanly instead of being stuck behind a stale inline value.
    if (!map || !editingFeatureId) return;
    setMapCursor(map, '');
  }, [map, editingFeatureId]);

  useEffect(() => {
    if (!map) return;
    ensureLayersAdded(map, data);
    // Icons register (and repaint once loaded) independently of layer
    // setup, so a rasterization failure can't block the base pins/lines/
    // polygons from rendering.
    ensureFeatureIconImages(map, iconRefs).catch((err) => console.error('Failed to register feature icons', err));
  }, [map, data, iconRefs]);

  useEffect(() => {
    if (!map) return;

    function handleStyleLoad() {
      if (!map) return;
      ensureLayersAdded(map, dataRef.current);
      applyHighlight(map, hoveredFeatureIdRef.current, selectedFeatureIdRef.current);
      ensureFeatureIconImages(map, iconRefsRef.current).catch((err) =>
        console.error('Failed to register feature icons', err),
      );
    }

    // A single map-level click handler (rather than per-layer listeners) so
    // clicking empty map background reliably clears the selection too.
    // Mapbox suppresses 'click' when the gesture involved real movement, so
    // this doesn't fire (and re-select) after a pin drag.
    function handleClick(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: existingLayers })
        : [];
      const featureId = hits[0]?.properties?.featureId;
      setSelection(typeof featureId === 'string' ? { type: 'feature', featureId } : null);
    }

    // Pressing down on a pin starts a drag instead of the map's own
    // drag-to-pan; e.preventDefault() stops that default camera behavior
    // for this gesture.
    function handleMouseDown(e: mapboxgl.MapMouseEvent) {
      if (!map || !map.getLayer(LAYER_IDS.point)) return;
      const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_IDS.point] });
      const hit = hits[0];
      const featureId = hit?.properties?.featureId;
      const layerId = hit?.properties?.layerId;
      if (typeof featureId !== 'string' || typeof layerId !== 'string') return;

      e.preventDefault();
      dragStateRef.current = { featureId, layerId, moved: false };
      setMapCursor(map, 'grabbing');
    }

    // A single map-level mousemove handler (rather than per-layer
    // mouseenter/mouseleave) avoids cursor flicker where two clickable
    // layers overlap the same feature (e.g. polygon fill + outline). It
    // also drives the hover highlight (the same one the layer panel's row
    // hover uses) so hovering a feature directly on the map lights it up
    // too, and — while a pin is being dragged — repositions it directly on
    // the source for live visual feedback without touching react-query.
    function handleMouseMove(e: mapboxgl.MapMouseEvent) {
      if (!map) return;

      const dragState = dragStateRef.current;
      if (dragState) {
        dragState.moved = true;
        const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        if (source) {
          const patched: GeoJSON.FeatureCollection = {
            ...dataRef.current,
            features: dataRef.current.features.map((feature) =>
              feature.properties?.featureId === dragState.featureId
                ? { ...feature, geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] } }
                : feature,
            ),
          };
          source.setData(patched);
        }
        return;
      }

      // While a feature is being vertex-edited via mapbox-gl-draw's
      // direct_select mode, take over cursor management ourselves rather
      // than relying on Draw's own CSS-class-driven cursor (see
      // DRAW_VERTEX_LAYER_IDS above for why that doesn't reliably work).
      // Only vertices get a special cursor; clearing to '' the rest of the
      // time lets Draw's own inherited styling (e.g. "move" over the
      // feature body) show through undisturbed.
      if (editingFeatureIdRef.current) {
        const vertexLayers = DRAW_VERTEX_LAYER_IDS.filter((id) => map.getLayer(id));
        const onVertex = vertexLayers.length > 0 && map.queryRenderedFeatures(e.point, { layers: vertexLayers }).length > 0;
        setMapCursor(map, onVertex ? 'pointer' : '');
        return;
      }

      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: existingLayers })
        : [];
      const hit = hits[0];
      setMapCursor(map, hit ? (hit.layer?.id === LAYER_IDS.point ? 'grab' : 'pointer') : '');
      const featureId = hit?.properties?.featureId;
      const nextHoveredId = typeof featureId === 'string' ? featureId : null;
      if (useEditorStore.getState().hoveredFeatureId !== nextHoveredId) {
        setHoveredFeatureId(nextHoveredId);
      }
    }

    function handleMouseUp(e: mapboxgl.MapMouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState || !map) return;
      dragStateRef.current = null;
      setMapCursor(map, 'grab');
      if (dragState.moved) {
        moveFeatureMutationRef.current.mutate({
          featureId: dragState.featureId,
          layerId: dragState.layerId,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
      }
    }

    // Safety net for releasing the mouse outside the map canvas mid-drag
    // (e.g. over a floating panel), which wouldn't fire the map's own
    // mouseup — snap the pin back to its last saved position instead of
    // leaving the drag stuck.
    function handleWindowMouseUp() {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      dragStateRef.current = null;
      if (map) {
        ensureLayersAdded(map, dataRef.current);
        setMapCursor(map, '');
      }
    }

    function handleMouseOut() {
      setHoveredFeatureId(null);
    }

    map.on('style.load', handleStyleLoad);
    map.on('click', handleClick);
    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.on('mouseout', handleMouseOut);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('click', handleClick);
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('mouseout', handleMouseOut);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      setMapCursor(map, '');
    };
  }, [map, setSelection, setHoveredFeatureId]);

  return null;
}
