import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, LineStyle, MapFeatureDTO } from '@mapinski/shared';
import { useEditorStore } from '../../lib/state/editorStore';
import { featuresQueryKey, fetchFeatures, updateFeature } from '../../lib/mapFeatures/api';
import { ensureFeatureIconImages, featureIconImageId, type FeatureIconRef } from '../../lib/map/featureIconImages';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_LABEL_COLORS,
  labelColorsForHighlight,
  sampleBasemapHighlightColor,
} from '../../lib/map/basemapContrast';
import { FEATURE_POINT_LAYER_ID, REMOTE_LAYER_ID_PREFIX } from '../../lib/map/featureLayerIds';

const SOURCE_ID = 'mapinski-features';
// Separate single-feature source the cursor-following label (see
// CURSOR_LABEL_TEXT_OFFSET) is driven from — its data is a lngLat updated on
// every mousemove, independent of the real feature geometry, so it can't
// share LAYER_IDS.hoverLabel's SOURCE_ID-backed, geometry-anchored layer.
const HOVER_CURSOR_SOURCE_ID = 'mapinski-features-hover-cursor';
const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
// Stable reference for the "no selection" case — returning a fresh `[]`
// literal from the Zustand selector below would make every snapshot look
// like a change to useSyncExternalStore, causing an infinite render loop
// ("Maximum update depth exceeded").
const EMPTY_FEATURE_IDS: string[] = [];
const LAYER_IDS = {
  polygonFill: 'mapinski-features-polygon-fill',
  polygonOutline: 'mapinski-features-polygon-outline',
  line: 'mapinski-features-line',
  lineHitArea: 'mapinski-features-line-hit-area',
  point: FEATURE_POINT_LAYER_ID,
  pointHover: 'mapinski-features-point-hover',
  geometryHover: 'mapinski-features-geometry-hover',
  hoverLabel: 'mapinski-features-hover-label',
  hoverLabelCursor: 'mapinski-features-hover-label-cursor',
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
const HOVER_LABEL_TEXT_SIZE = 12;
// Lifts the label clear of the point icon it's labeling — text offset is in
// ems, so negative-y moves it up regardless of text-size.
const HOVER_LABEL_OFFSET_EM = -1.8;
// Nudges the cursor-following label down-right of the pointer (paired with
// a top-left text-anchor below) rather than centering it on the cursor,
// where it'd overlap the pointer icon and whatever's directly under it.
const CURSOR_LABEL_OFFSET_EM: [number, number] = [1.1, 0.8];
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

// This component's own mousemove handler below runs last among the map's
// listeners (RemoteLayer mounts first — see its own comment), so it has the
// final say on the cursor every move; it must account for a hit on an
// external-data feature itself rather than blindly clearing back to the
// default arrow over what RemoteLayer already marked as clickable.
function hoveringRemoteFeature(map: mapboxgl.Map, point: mapboxgl.Point): boolean {
  const remoteLayerIds = (map.getStyle()?.layers ?? [])
    .map((layer) => layer.id)
    .filter((id) => id.startsWith(REMOTE_LAYER_ID_PREFIX));
  if (remoteLayerIds.length === 0) return false;
  return map.queryRenderedFeatures(point, { layers: remoteLayerIds }).length > 0;
}

function highlightFilter(featureIds: string[], geometryTypes: string[]): mapboxgl.FilterSpecification {
  return [
    'all',
    ['in', ['geometry-type'], ['literal', geometryTypes]],
    ['in', ['get', 'featureId'], ['literal', featureIds]],
  ];
}

// '' never matches a real featureId, so this renders nothing when nothing's
// hovered rather than needing a separate "none hovered" branch. Restricted
// to Points — LineStrings/Polygons use the cursor-following label instead
// (see LAYER_IDS.hoverLabelCursor), since a fixed geometry anchor can end up
// far from the cursor on a large shape.
function hoverLabelFilter(hoveredFeatureId: string | null): mapboxgl.FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], 'Point'],
    ['==', ['get', 'featureId'], hoveredFeatureId ?? ''],
    ['!=', ['get', 'title'], ''],
  ];
}

function setHighlightFilters(map: mapboxgl.Map, featureIds: string[]) {
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setFilter(LAYER_IDS.pointHover, highlightFilter(featureIds, ['Point']));
  }
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setFilter(LAYER_IDS.geometryHover, highlightFilter(featureIds, ['LineString', 'Polygon']));
  }
}

function setHighlightOpacity(map: mapboxgl.Map, visible: boolean) {
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-opacity', visible ? POINT_HOVER_OPACITY : 0);
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-stroke-opacity', visible ? 1 : 0);
  }
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setPaintProperty(LAYER_IDS.geometryHover, 'line-opacity', visible ? 1 : 0);
  }
}

interface HighlightFadeState {
  // The feature ids the hover/selection layers are currently filtered to
  // render. While fading out this lags one step behind the real
  // hovered/selected ids (see applyHighlight) so there's still something on
  // screen for the opacity transition to actually animate.
  renderedIds: string[];
  fadeOutTimeoutId: number | null;
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
// whenever highlighted-ness flips between "nothing" and "something".
//
// Fading in is simple: the filter and the opacity ramp can change together,
// since the newly-shown feature has nothing to visually jump from. Fading
// out is the opposite problem — setFilter takes effect instantly, so
// dropping a feature from the filter at the same moment as starting the
// opacity ramp would erase it before the transition ever gets a frame to
// play. So on the way out, the feature is kept in the filter (fadeState
// tracks it as `renderedIds`) while opacity ramps down, and only removed
// from the filter once the transition has had time to finish. Swapping the
// highlight directly from one feature to another (without passing through
// "nothing highlighted") still doesn't itself fade, since the opacity value
// never changes in that case — only entering/leaving "nothing highlighted"
// does.
function applyHighlight(
  map: mapboxgl.Map,
  hoveredFeatureId: string | null,
  selectedFeatureIds: string[],
  fadeState: HighlightFadeState,
) {
  const highlightedIds = [
    ...new Set([...(hoveredFeatureId !== null ? [hoveredFeatureId] : []), ...selectedFeatureIds]),
  ];
  const visible = highlightedIds.length > 0;

  if (fadeState.fadeOutTimeoutId !== null) {
    window.clearTimeout(fadeState.fadeOutTimeoutId);
    fadeState.fadeOutTimeoutId = null;
  }

  if (visible) {
    fadeState.renderedIds = highlightedIds;
    setHighlightFilters(map, highlightedIds);
    setHighlightOpacity(map, true);
    return;
  }

  setHighlightFilters(map, fadeState.renderedIds);
  setHighlightOpacity(map, false);
  fadeState.fadeOutTimeoutId = window.setTimeout(() => {
    fadeState.renderedIds = [];
    fadeState.fadeOutTimeoutId = null;
    setHighlightFilters(map, []);
  }, HIGHLIGHT_FADE_DURATION_MS);
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
  // Added last so it draws above icons/lines/polygons and their hover rings.
  // No background/box by design — just text with a halo for legibility,
  // per the "not an obstructive tooltip" ask this replaces.
  map.addLayer({
    id: LAYER_IDS.hoverLabel,
    type: 'symbol',
    source: SOURCE_ID,
    filter: hoverLabelFilter(null),
    layout: {
      'text-field': ['get', 'title'],
      'text-size': HOVER_LABEL_TEXT_SIZE,
      'text-anchor': 'bottom',
      'text-offset': [0, HOVER_LABEL_OFFSET_EM],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': DEFAULT_LABEL_COLORS.text,
      'text-halo-color': DEFAULT_LABEL_COLORS.halo,
      'text-halo-width': 1,
      'text-halo-blur': 0.5,
    },
  });
  // Cursor-following label for LineString/Polygon hover — see
  // HOVER_CURSOR_SOURCE_ID. Starts empty; handleMouseMove below drives its
  // single feature's position and title live.
  map.addSource(HOVER_CURSOR_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  map.addLayer({
    id: LAYER_IDS.hoverLabelCursor,
    type: 'symbol',
    source: HOVER_CURSOR_SOURCE_ID,
    layout: {
      'text-field': ['get', 'title'],
      'text-size': HOVER_LABEL_TEXT_SIZE,
      'text-anchor': 'top-left',
      'text-offset': CURSOR_LABEL_OFFSET_EM,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': DEFAULT_LABEL_COLORS.text,
      'text-halo-color': DEFAULT_LABEL_COLORS.halo,
      'text-halo-width': 1,
      'text-halo-blur': 0.5,
    },
  });
}

interface PointDragState {
  featureId: string;
  layerId: string;
  moved: boolean;
  previousGeometry: GeoJSON.Geometry;
}

export function FeatureLayer({ map, layers, editingFeatureId = null }: FeatureLayerProps) {
  const queryClient = useQueryClient();
  const setSelection = useEditorStore((s) => s.setSelection);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const hoveredFeatureId = useEditorStore((s) => s.hoveredFeatureId);
  const setHoveredFeatureId = useEditorStore((s) => s.setHoveredFeatureId);
  const selectedFeatureIds = useEditorStore((s) =>
    s.selection?.type === 'feature' ? s.selection.featureIds : EMPTY_FEATURE_IDS,
  );
  // Zustand's selector above returns a fresh array reference every render —
  // derive a stable string key so the highlight effect below only re-runs
  // when membership actually changes, same pattern as featureQueries'
  // dataUpdatedAt join a few lines up.
  const selectedFeatureIdsKey = selectedFeatureIds.join(',');
  const dragStateRef = useRef<PointDragState | null>(null);
  // Tracks whether HOVER_CURSOR_SOURCE_ID currently holds a visible feature,
  // so handleMouseMove only calls setData when that's actually changing
  // rather than on every mousemove over empty map background.
  const cursorLabelVisibleRef = useRef(false);

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
  const selectedFeatureIdsRef = useRef(selectedFeatureIds);
  selectedFeatureIdsRef.current = selectedFeatureIds;
  const moveFeatureMutationRef = useRef(moveFeatureMutation);
  moveFeatureMutationRef.current = moveFeatureMutation;
  const editingFeatureIdRef = useRef(editingFeatureId);
  editingFeatureIdRef.current = editingFeatureId;
  const highlightFadeStateRef = useRef<HighlightFadeState>({ renderedIds: [], fadeOutTimeoutId: null });

  useEffect(() => {
    if (!map) return;
    applyHighlight(map, hoveredFeatureId, selectedFeatureIds, highlightFadeStateRef.current);
    return () => {
      const timeoutId = highlightFadeStateRef.current.fadeOutTimeoutId;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hoveredFeatureId, selectedFeatureIdsKey]);

  // Tied to hover alone (not selection, unlike the ring/border highlight
  // above) since the label is meant as an at-a-glance hover cue, not a
  // lingering indicator of what's selected.
  useEffect(() => {
    if (!map || !map.getLayer(LAYER_IDS.hoverLabel)) return;
    map.setFilter(LAYER_IDS.hoverLabel, hoverLabelFilter(hoveredFeatureId));
  }, [map, hoveredFeatureId]);

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
      const labelColors = labelColorsForHighlight(color);
      if (map.getLayer(LAYER_IDS.hoverLabel)) {
        map.setPaintProperty(LAYER_IDS.hoverLabel, 'text-color', labelColors.text);
        map.setPaintProperty(LAYER_IDS.hoverLabel, 'text-halo-color', labelColors.halo);
      }
      if (map.getLayer(LAYER_IDS.hoverLabelCursor)) {
        map.setPaintProperty(LAYER_IDS.hoverLabelCursor, 'text-color', labelColors.text);
        map.setPaintProperty(LAYER_IDS.hoverLabelCursor, 'text-halo-color', labelColors.halo);
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
      // ensureLayersAdded just recreated HOVER_CURSOR_SOURCE_ID empty (all
      // custom sources are gone after a style change), so the JS-side "is it
      // showing something" flag needs to match.
      cursorLabelVisibleRef.current = false;
      applyHighlight(map, hoveredFeatureIdRef.current, selectedFeatureIdsRef.current, highlightFadeStateRef.current);
      map.setFilter(LAYER_IDS.hoverLabel, hoverLabelFilter(hoveredFeatureIdRef.current));
      ensureFeatureIconImages(map, iconRefsRef.current).catch((err) =>
        console.error('Failed to register feature icons', err),
      );
    }

    // Drives HOVER_CURSOR_SOURCE_ID's single feature — the LineString/
    // Polygon counterpart to LAYER_IDS.hoverLabel's geometry-anchored,
    // Point-only label (see hoverLabelFilter).
    function setCursorLabel(targetMap: mapboxgl.Map, lngLat: mapboxgl.LngLat, title: string) {
      const source = targetMap.getSource(HOVER_CURSOR_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] },
            properties: { title },
          },
        ],
      });
      cursorLabelVisibleRef.current = true;
    }

    function clearCursorLabel(targetMap: mapboxgl.Map) {
      if (!cursorLabelVisibleRef.current) return;
      const source = targetMap.getSource(HOVER_CURSOR_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (source) source.setData(EMPTY_FEATURE_COLLECTION);
      cursorLabelVisibleRef.current = false;
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
      if (typeof featureId === 'string') {
        setSelection({ type: 'feature', featureIds: [featureId] });
        setSelectedLayerId(null);
      } else {
        setSelection(null);
      }
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
      const currentFeature = dataRef.current.features.find((f) => f.properties?.featureId === featureId);
      if (!currentFeature?.geometry) return;

      e.preventDefault();
      dragStateRef.current = { featureId, layerId, moved: false, previousGeometry: currentFeature.geometry };
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
        clearCursorLabel(map);
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
        clearCursorLabel(map);
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
      if (hit) {
        setMapCursor(map, hit.layer?.id === LAYER_IDS.point ? 'grab' : 'pointer');
      } else {
        setMapCursor(map, hoveringRemoteFeature(map, e.point) ? 'pointer' : '');
      }
      const featureId = hit?.properties?.featureId;
      const nextHoveredId = typeof featureId === 'string' ? featureId : null;
      if (useEditorStore.getState().hoveredFeatureId !== nextHoveredId) {
        setHoveredFeatureId(nextHoveredId);
      }

      // Points keep their existing geometry-anchored label (LAYER_IDS.
      // hoverLabel); LineStrings/Polygons get this cursor-following one
      // instead, since a fixed anchor can land far from the cursor on a
      // large shape.
      const title = hit?.properties?.title;
      if (hit && hit.layer?.id !== LAYER_IDS.point && typeof title === 'string' && title !== '') {
        setCursorLabel(map, e.lngLat, title);
      } else {
        clearCursorLabel(map);
      }
    }

    function handleMouseUp(e: mapboxgl.MapMouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState || !map) return;
      dragStateRef.current = null;
      setMapCursor(map, 'grab');
      if (dragState.moved) {
        useEditorStore.getState().pushMoveHistory({
          featureId: dragState.featureId,
          layerId: dragState.layerId,
          previousGeometry: dragState.previousGeometry,
        });
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
      if (map) clearCursorLabel(map);
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
  }, [map, setSelection, setSelectedLayerId, setHoveredFeatureId]);

  return null;
}
