import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, LayerStyleConfig, MapFeaturePropertiesDTO } from '@mapinski/shared';
import { useEditorStore } from '../../lib/state/editorStore';
import { externalLayerDataQueryKey, fetchExternalLayerData } from '../../lib/layers/api';
import { createFeature, featuresQueryKey } from '../../lib/mapFeatures/api';
import { SANITIZE_CONFIG } from '../../lib/mapFeatures/sanitizeConfig';
import {
  DEFAULT_LABEL_COLORS,
  labelColorsForHighlight,
  sampleBasemapHighlightColor,
  type LabelColors,
} from '../../lib/map/basemapContrast';
import { ensureExternalIconImages, externalIconImageId } from '../../lib/map/externalIconImages';
import { REMOTE_LAYER_ID_PREFIX } from '../../lib/map/featureLayerIds';
import { RemoteFeaturePopup, type RemoteFeatureSelection } from './RemoteFeaturePopup';

// Local features have no arbitrary property bag (MapFeaturePropertiesDTO is a
// fixed set of fields), so copying a remote feature folds its raw properties
// into the new feature's description instead of silently discarding them.
const MAX_COPIED_PROPERTIES = 20;
// Local map_features geometry is deliberately narrower than what external
// feeds can contain (see geometrySchema vs externalGeometrySchema in
// packages/shared/src/geojson.ts) — Multi* geometries can't be copied in.
const COPYABLE_GEOMETRY_TYPES = new Set(['Point', 'LineString', 'Polygon']);

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCopiedPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function buildCopiedDescriptionHtml(properties: GeoJSON.GeoJsonProperties, skipKey: string | null): string {
  const entries = Object.entries(properties ?? {})
    .filter(([key, value]) => key !== skipKey && value !== null && value !== undefined && value !== '')
    .slice(0, MAX_COPIED_PROPERTIES);
  if (entries.length === 0) return '';
  const items = entries
    .map(
      ([key, value]) =>
        `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(formatCopiedPropertyValue(value))}</li>`,
    )
    .join('');
  return `<ul>${items}</ul>`;
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const FILL_OPACITY = 0.25;
const LINE_WIDTH = 3;
const OUTLINE_WIDTH = 2;
const POINT_RADIUS = 6;
const POINT_STROKE_WIDTH = 1.5;
const POINT_STROKE_COLOR = '#ffffff';
const LABEL_TEXT_SIZE = 12;
const LABEL_OFFSET_EM = 1.4;
const ICON_SIZE = 0.5;

// mapbox-gl doesn't export its `ExpressionSpecification` type, so this is a
// minimal structural stand-in (a tuple with a string operator head) that's
// still assignable to the paint/filter spec's expression types.
type MapboxExpression = [string, ...unknown[]];
// Always evaluates false — used as a sentinel filter for the icon sub-layer
// when no icon rule is active, so the layer exists (for style-load
// resilience) but renders nothing.
const NEVER_FILTER: MapboxExpression = ['literal', false];

function sourceId(layerId: string) {
  return `${REMOTE_LAYER_ID_PREFIX}${layerId}`;
}

function subLayerIds(layerId: string) {
  const base = sourceId(layerId);
  return {
    fill: `${base}-fill`,
    outline: `${base}-outline`,
    line: `${base}-line`,
    point: `${base}-point`,
    label: `${base}-label`,
    icon: `${base}-icon`,
  };
}

// Falls back to the flat layer color unless a numeric colorProperty with two
// valid (ascending) stops is configured, in which case features are
// colorized by interpolating between the low/high stops. `to-number` guards
// against a property that's a string in some features (mixed-quality feeds).
function buildColorExpression(flatColor: string, styleConfig: LayerStyleConfig | null): string | MapboxExpression {
  const colorProperty = styleConfig?.colorProperty;
  const stops = styleConfig?.colorStops;
  if (!colorProperty || !stops || stops.length < 2) return flatColor;
  const [low, high] = stops;
  if (!(low.value < high.value)) return flatColor;
  return [
    'interpolate',
    ['linear'],
    ['to-number', ['get', colorProperty], 0],
    low.value,
    low.color,
    high.value,
    high.color,
  ];
}

function labelTextField(labelProperty: string | null | undefined): string | MapboxExpression {
  return labelProperty ? ['to-string', ['get', labelProperty]] : '';
}

// Only rules whose image actually loaded onto the map are usable — a rule
// referencing a url that 404'd or lacks CORS support falls back to the
// default circle marker rather than rendering nothing.
function usableIconRules(styleConfig: LayerStyleConfig | null, loadedIconUrls: ReadonlySet<string>) {
  if (!styleConfig?.iconProperty) return [];
  return (styleConfig.iconRules ?? []).filter((rule) => rule.iconUrl && loadedIconUrls.has(rule.iconUrl));
}

// A point matches the icon layer when its iconProperty value is one of the
// usable rules' values; every other point (no rule, or a rule whose image
// failed to load) falls through to the plain circle layer instead.
function iconValuesFilter(
  styleConfig: LayerStyleConfig | null,
  loadedIconUrls: ReadonlySet<string>,
): MapboxExpression | null {
  const rules = usableIconRules(styleConfig, loadedIconUrls);
  if (rules.length === 0) return null;
  return ['in', ['get', styleConfig!.iconProperty], ['literal', rules.map((r) => r.value)]];
}

function iconImageExpression(
  styleConfig: LayerStyleConfig | null,
  loadedIconUrls: ReadonlySet<string>,
): string | MapboxExpression {
  const rules = usableIconRules(styleConfig, loadedIconUrls);
  if (rules.length === 0) return '';
  const match: unknown[] = ['match', ['get', styleConfig!.iconProperty]];
  for (const rule of rules) match.push(rule.value, externalIconImageId(rule.iconUrl));
  match.push(''); // unmatched values: no icon (they're excluded by the point layer's own filter anyway)
  return match as MapboxExpression;
}

function pointFilter(iconFilter: MapboxExpression | null): MapboxExpression {
  const base: MapboxExpression = ['==', ['geometry-type'], 'Point'];
  return iconFilter ? (['all', base, ['!', iconFilter]] as MapboxExpression) : base;
}

// Mapbox's `geometry-type` expression already collapses Multi* geometries
// into their singular counterpart (MultiPolygon -> 'Polygon', etc.), so no
// separate handling is needed for them here — see FeatureLayer.tsx's own
// use of the same expression for local features.
function ensureRemoteLayerAdded(
  map: mapboxgl.Map,
  layer: LayerDTO,
  loadedIconUrls: ReadonlySet<string>,
  labelColors: LabelColors,
  data: GeoJSON.FeatureCollection,
) {
  const layerId = layer.id;
  const id = sourceId(layerId);
  const ids = subLayerIds(layerId);
  const colorExpression = buildColorExpression(layer.color, layer.styleConfig);
  const iconFilter = iconValuesFilter(layer.styleConfig, loadedIconUrls);
  const styleConfig = layer.styleConfig;
  // Vector sources (pmtiles-url) have no setData equivalent — a fetched
  // tile is immutable once loaded, and the source URL/source-layer are
  // fixed at layer-creation time, so there's nothing to refresh here.
  const isVectorSource = layer.sourceType === 'pmtiles-url';
  const sourceLayerProps = isVectorSource ? { 'source-layer': layer.sourceLayer! } : {};
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | mapboxgl.VectorTileSource | undefined;
  if (existing) {
    if (!isVectorSource) (existing as mapboxgl.GeoJSONSource).setData(data);
    if (map.getLayer(ids.fill)) map.setPaintProperty(ids.fill, 'fill-color', colorExpression);
    if (map.getLayer(ids.outline)) map.setPaintProperty(ids.outline, 'line-color', colorExpression);
    if (map.getLayer(ids.line)) map.setPaintProperty(ids.line, 'line-color', colorExpression);
    if (map.getLayer(ids.point)) {
      map.setPaintProperty(ids.point, 'circle-color', colorExpression);
      map.setFilter(ids.point, pointFilter(iconFilter));
    }
    if (map.getLayer(ids.label)) {
      map.setLayoutProperty(ids.label, 'text-field', labelTextField(styleConfig?.labelProperty));
      map.setPaintProperty(ids.label, 'text-color', labelColors.text);
      map.setPaintProperty(ids.label, 'text-halo-color', labelColors.halo);
    }
    if (map.getLayer(ids.icon)) {
      map.setFilter(ids.icon, iconFilter ? (['all', ['==', ['geometry-type'], 'Point'], iconFilter] as MapboxExpression) : NEVER_FILTER);
      map.setLayoutProperty(ids.icon, 'icon-image', iconImageExpression(styleConfig, loadedIconUrls));
    }
    return;
  }

  if (isVectorSource) {
    // 'pmtiles' is a built-in Mapbox GL TileProvider name — the browser
    // lazy-loads Mapbox's own official provider module the first time a
    // vector source references it, which reads tiles from the archive at
    // this URL via HTTP range requests. No protocol registration needed.
    map.addSource(id, { type: 'vector', url: layer.sourceUrl!, provider: 'pmtiles' });
  } else {
    map.addSource(id, { type: 'geojson', data });
  }
  map.addLayer({
    id: ids.fill,
    type: 'fill',
    source: id,
    ...sourceLayerProps,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': colorExpression, 'fill-opacity': FILL_OPACITY },
  });
  map.addLayer({
    id: ids.outline,
    type: 'line',
    source: id,
    ...sourceLayerProps,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colorExpression, 'line-width': OUTLINE_WIDTH },
  });
  map.addLayer({
    id: ids.line,
    type: 'line',
    source: id,
    ...sourceLayerProps,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colorExpression, 'line-width': LINE_WIDTH },
  });
  map.addLayer({
    id: ids.point,
    type: 'circle',
    source: id,
    ...sourceLayerProps,
    filter: pointFilter(iconFilter),
    paint: {
      'circle-color': colorExpression,
      'circle-radius': POINT_RADIUS,
      'circle-stroke-color': POINT_STROKE_COLOR,
      'circle-stroke-width': POINT_STROKE_WIDTH,
    },
  });
  // Points whose iconProperty value matches a loaded icon rule render here
  // instead of on the circle layer above (see pointFilter/iconValuesFilter).
  map.addLayer({
    id: ids.icon,
    type: 'symbol',
    source: id,
    ...sourceLayerProps,
    filter: iconFilter ? (['all', ['==', ['geometry-type'], 'Point'], iconFilter] as MapboxExpression) : NEVER_FILTER,
    layout: {
      'icon-image': iconImageExpression(styleConfig, loadedIconUrls),
      'icon-size': ICON_SIZE,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  // No geometry-type filter: unlike the layers above, labels apply across
  // Points, LineStrings, and Polygons alike, using Mapbox's default symbol
  // placement to pick a representative anchor per geometry (e.g. a
  // polygon's interior point).
  map.addLayer({
    id: ids.label,
    type: 'symbol',
    source: id,
    ...sourceLayerProps,
    layout: {
      'text-field': labelTextField(styleConfig?.labelProperty),
      'text-size': LABEL_TEXT_SIZE,
      'text-anchor': 'top',
      'text-offset': [0, LABEL_OFFSET_EM],
    },
    paint: {
      'text-color': labelColors.text,
      'text-halo-color': labelColors.halo,
      'text-halo-width': 1,
      'text-halo-blur': 0.5,
    },
  });
}

function removeRemoteLayer(map: mapboxgl.Map, layerId: string) {
  const ids = subLayerIds(layerId);
  for (const id of Object.values(ids)) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(sourceId(layerId))) map.removeSource(sourceId(layerId));
}

function setRemoteLayerVisibility(map: mapboxgl.Map, layerId: string, visible: boolean) {
  const ids = subLayerIds(layerId);
  const visibility = visible ? 'visible' : 'none';
  for (const id of Object.values(ids)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
  }
}

interface RemoteLayerProps {
  map: mapboxgl.Map | null;
  layers: LayerDTO[];
}

// Renders layers backed by an external GeoJSON URL (see AddExternalLayerDialog)
// directly from fetched data, without persisting individual features to
// map_features — a sibling to FeatureLayer, which owns the user-drawn data.
// Mounted before FeatureLayer in MapEditorPage so remote overlays render
// beneath the user's own local layers.
export function RemoteLayer({ map, layers }: RemoteLayerProps) {
  const remoteLayers = layers.filter((layer) => layer.sourceType === 'geojson-url' || layer.sourceType === 'pmtiles-url');
  const queryClient = useQueryClient();
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;

  // pmtiles-url layers render straight from their source URL via Mapbox's
  // vector source (see ensureRemoteLayerAdded) — no server round-trip, so
  // no query is enabled for them here.
  const dataQueries = useQueries({
    queries: remoteLayers.map((layer) => ({
      queryKey: externalLayerDataQueryKey(layer.id),
      queryFn: () => fetchExternalLayerData(layer.id),
      enabled: layer.sourceType === 'geojson-url',
      staleTime: Infinity,
    })),
  });

  const stateRef = useRef({ remoteLayers, dataQueries });
  stateRef.current = { remoteLayers, dataQueries };
  const knownLayerIdsRef = useRef<Set<string>>(new Set());
  const layerMetaBySubLayerRef = useRef<Map<string, { layerId: string; layerName: string; layerColor: string }>>(
    new Map(),
  );
  // Which icon urls have successfully loaded onto the *current* map style —
  // starts empty each style load since runtime images don't survive a style
  // change, then fills in as ensureExternalIconImages resolves (see below).
  const loadedIconUrlsRef = useRef<Set<string>>(new Set());
  // Updated by the contrast-sampling effect below; read here so a
  // newly-added layer's label starts out with the last-known-good colors
  // instead of always the light-basemap default.
  const labelColorsRef = useRef<LabelColors>(DEFAULT_LABEL_COLORS);
  const [selection, setSelection] = useState<RemoteFeatureSelection | null>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    function syncLayers() {
      if (!map) return;
      const { remoteLayers: currentLayers, dataQueries: currentQueries } = stateRef.current;
      const currentIds = new Set(currentLayers.map((l) => l.id));

      for (const id of knownLayerIdsRef.current) {
        if (!currentIds.has(id)) removeRemoteLayer(map, id);
      }
      knownLayerIdsRef.current = currentIds;

      const meta = new Map<string, { layerId: string; layerName: string; layerColor: string }>();
      currentLayers.forEach((layer, index) => {
        const data = currentQueries[index]?.data ?? EMPTY_COLLECTION;
        ensureRemoteLayerAdded(map, layer, loadedIconUrlsRef.current, labelColorsRef.current, data);
        setRemoteLayerVisibility(map, layer.id, layer.visible);
        for (const subLayerId of Object.values(subLayerIds(layer.id))) {
          meta.set(subLayerId, { layerId: layer.id, layerName: layer.name, layerColor: layer.color });
        }
      });
      layerMetaBySubLayerRef.current = meta;

      const iconUrls = currentLayers.flatMap((l) => (l.styleConfig?.iconRules ?? []).map((r) => r.iconUrl));
      if (iconUrls.length === 0) return;
      ensureExternalIconImages(map, iconUrls).then(({ loaded, failed }) => {
        if (cancelled) return;
        useEditorStore.getState().setFailedIconUrls(failed);
        const prev = loadedIconUrlsRef.current;
        const changed = loaded.size !== prev.size || [...loaded].some((url) => !prev.has(url));
        loadedIconUrlsRef.current = loaded;
        // Re-run only once newly-loaded images actually change which points
        // qualify for the icon layer — loadCached's cache means repeat
        // calls resolve near-instantly once everything's warm.
        if (changed) syncLayers();
      });
    }

    syncLayers();
    map.on('style.load', syncLayers);
    return () => {
      cancelled = true;
      map.off('style.load', syncLayers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    remoteLayers
      .map(
        (l) =>
          `${l.id}:${l.name}:${l.color}:${l.visible}:${l.sourceType}:${l.sourceUrl}:${l.sourceLayer}:${JSON.stringify(l.styleConfig)}`,
      )
      .join(','),
    dataQueries.map((q) => q.dataUpdatedAt).join(','),
  ]);

  // Keeps label text/halo colors legible against the actual basemap —
  // mirrors FeatureLayer.tsx's applyContrastColor for its hover highlight,
  // sampling the map's rendered pixels rather than assuming a light basemap.
  useEffect(() => {
    if (!map) return;

    function applyLabelContrastColor() {
      if (!map) return;
      labelColorsRef.current = labelColorsForHighlight(sampleBasemapHighlightColor(map));
      for (const layer of stateRef.current.remoteLayers) {
        const id = subLayerIds(layer.id).label;
        if (!map.getLayer(id)) continue;
        map.setPaintProperty(id, 'text-color', labelColorsRef.current.text);
        map.setPaintProperty(id, 'text-halo-color', labelColorsRef.current.halo);
      }
    }

    // A style's tiles aren't guaranteed to be rendered the instant
    // 'style.load' fires, so wait for the map to actually go idle (nothing
    // left to load) before sampling it. Re-run on every basemap switch, not
    // just the initial style.
    function scheduleContrastUpdate() {
      map?.once('idle', applyLabelContrastColor);
    }

    scheduleContrastUpdate();
    map.on('style.load', scheduleContrastUpdate);
    return () => {
      map.off('style.load', scheduleContrastUpdate);
    };
  }, [map]);

  // Click-to-inspect: shows the raw properties of whichever external
  // feature was clicked, independent of FeatureLayer's own click handling
  // for local features (the two overlays don't otherwise interact).
  useEffect(() => {
    if (!map) return;

    function queryableLayers(): string[] {
      return [...layerMetaBySubLayerRef.current.keys()].filter((id) => map!.getLayer(id));
    }

    function handleClick(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const existingLayers = queryableLayers();
      const hits = existingLayers.length ? map.queryRenderedFeatures(e.point, { layers: existingLayers }) : [];
      const hit = hits[0];
      if (!hit || !hit.layer) {
        setSelection(null);
        return;
      }
      const meta = layerMetaBySubLayerRef.current.get(hit.layer.id);
      if (!meta) {
        setSelection(null);
        return;
      }
      setSelection({
        feature: hit,
        layerId: meta.layerId,
        layerName: meta.layerName,
        layerColor: meta.layerColor,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
      });
    }

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map]);

  const addFeatureMutation = useMutation({
    mutationFn: ({
      layerId,
      geometry,
      properties,
    }: {
      layerId: string;
      geometry: GeoJSON.Geometry;
      properties: Partial<MapFeaturePropertiesDTO>;
    }) => createFeature(layerId, { geometry, properties }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(vars.layerId) });
      setSelection(null);
    },
  });

  const selectionGeometryType = selection?.feature.geometry?.type;
  let addDisabledReason: string | null = null;
  if (!activeLayer) {
    addDisabledReason = 'Select a layer first';
  } else if (activeLayer.sourceType !== 'local') {
    addDisabledReason = 'Select one of your own layers first';
  } else if (!selectionGeometryType || !COPYABLE_GEOMETRY_TYPES.has(selectionGeometryType)) {
    addDisabledReason = "This feature's shape can't be copied yet";
  }

  function handleAddToActiveLayer() {
    if (!selection || !activeLayer || addDisabledReason) return;
    const sourceLayer = layers.find((l) => l.id === selection.layerId);
    const labelProperty = sourceLayer?.styleConfig?.labelProperty ?? null;
    const rawTitle = labelProperty ? selection.feature.properties?.[labelProperty] : undefined;
    addFeatureMutation.mutate({
      layerId: activeLayer.id,
      geometry: selection.feature.geometry,
      properties: {
        title: rawTitle != null ? String(rawTitle) : '',
        descriptionHtml: DOMPurify.sanitize(
          buildCopiedDescriptionHtml(selection.feature.properties, labelProperty),
          SANITIZE_CONFIG,
        ),
      },
    });
  }

  return (
    <RemoteFeaturePopup
      map={map}
      selection={selection}
      onClose={() => setSelection(null)}
      activeLayerName={activeLayer?.sourceType === 'local' ? activeLayer.name : null}
      addDisabledReason={addDisabledReason}
      isAdding={addFeatureMutation.isPending}
      onAddToActiveLayer={handleAddToActiveLayer}
    />
  );
}
