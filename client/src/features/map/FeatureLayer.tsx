import { useEffect, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, LineStyle, MapFeatureDTO } from '@mapinski/shared';
import { useEditorStore } from '../../state/editorStore';
import { featuresQueryKey, fetchFeatures } from '../mapFeatures/api';
import { ensureFeatureIconImages, featureIconImageId, type FeatureIconRef } from './featureIconImages';

const SOURCE_ID = 'mapinski-features';
const LAYER_IDS = {
  polygonFill: 'mapinski-features-polygon-fill',
  polygonOutline: 'mapinski-features-polygon-outline',
  line: 'mapinski-features-line',
  point: 'mapinski-features-point',
  pointHover: 'mapinski-features-point-hover',
  geometryHover: 'mapinski-features-geometry-hover',
};
const CLICKABLE_LAYER_IDS = [LAYER_IDS.polygonFill, LAYER_IDS.line, LAYER_IDS.point];
const POINT_ICON_SIZE = 0.4;
const POINT_HOVER_RADIUS = 18;
const POINT_HOVER_STROKE_WIDTH = 5;
const GEOMETRY_HOVER_WIDTH = 11;
const HOVER_COLOR = '#ffffff';
const DEFAULT_STROKE_WIDTH = 3;

// mapbox's line-dasharray only accepts a fixed array per-feature (no
// omitting it for "solid"), so a solid line is represented as one long dash
// with no gap — the standard workaround for mixing dash styles within a
// single data-driven layer.
const LINE_DASH_ARRAYS: Record<LineStyle, number[]> = {
  solid: [1, 0],
  dashed: [3, 2],
  dotted: [0, 2],
};

function hoverFilter(featureId: string | null, geometryTypes: string[]): mapboxgl.FilterSpecification {
  return [
    'all',
    ['in', ['geometry-type'], ['literal', geometryTypes]],
    ['==', ['get', 'featureId'], featureId ?? ''],
  ];
}

function applyHoverFilters(map: mapboxgl.Map, featureId: string | null) {
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setFilter(LAYER_IDS.pointHover, hoverFilter(featureId, ['Point']));
  }
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setFilter(LAYER_IDS.geometryHover, hoverFilter(featureId, ['LineString', 'Polygon']));
  }
}

interface FeatureLayerProps {
  map: mapboxgl.Map | null;
  layers: LayerDTO[];
}

function buildFeatureCollection(
  layers: LayerDTO[],
  featuresByLayer: Map<string, MapFeatureDTO[]>,
): { collection: GeoJSON.FeatureCollection; iconRefs: FeatureIconRef[] } {
  const features: GeoJSON.Feature[] = [];
  const iconRefs: FeatureIconRef[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const feature of featuresByLayer.get(layer.id) ?? []) {
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
      filter: hoverFilter(null, ['LineString', 'Polygon']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': HOVER_COLOR, 'line-width': GEOMETRY_HOVER_WIDTH },
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
    filter: hoverFilter(null, ['Point']),
    paint: {
      'circle-radius': POINT_HOVER_RADIUS,
      'circle-color': HOVER_COLOR,
      'circle-opacity': 0.3,
      'circle-stroke-width': POINT_HOVER_STROKE_WIDTH,
      'circle-stroke-color': HOVER_COLOR,
    },
  });
}

export function FeatureLayer({ map, layers }: FeatureLayerProps) {
  const setSelection = useEditorStore((s) => s.setSelection);
  const hoveredFeatureId = useEditorStore((s) => s.hoveredFeatureId);
  const setHoveredFeatureId = useEditorStore((s) => s.setHoveredFeatureId);

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
    const { collection, iconRefs } = buildFeatureCollection(layers, featuresByLayer);
    return { data: collection, iconRefs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, featureQueries.map((q) => q.dataUpdatedAt).join(',')]);

  const dataRef = useRef(data);
  dataRef.current = data;
  const iconRefsRef = useRef(iconRefs);
  iconRefsRef.current = iconRefs;
  const hoveredFeatureIdRef = useRef(hoveredFeatureId);
  hoveredFeatureIdRef.current = hoveredFeatureId;

  useEffect(() => {
    if (!map) return;
    applyHoverFilters(map, hoveredFeatureId);
  }, [map, hoveredFeatureId]);

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
      applyHoverFilters(map, hoveredFeatureIdRef.current);
      ensureFeatureIconImages(map, iconRefsRef.current).catch((err) =>
        console.error('Failed to register feature icons', err),
      );
    }

    // A single map-level click handler (rather than per-layer listeners) so
    // clicking empty map background reliably clears the selection too.
    function handleClick(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: existingLayers })
        : [];
      const featureId = hits[0]?.properties?.featureId;
      setSelection(typeof featureId === 'string' ? { type: 'feature', featureId } : null);
    }

    // A single map-level mousemove handler (rather than per-layer
    // mouseenter/mouseleave) avoids cursor flicker where two clickable
    // layers overlap the same feature (e.g. polygon fill + outline). It
    // also drives the hover highlight (the same one the layer panel's row
    // hover uses) so hovering a feature directly on the map lights it up too.
    function handleMouseMove(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: existingLayers })
        : [];
      map.getCanvas().style.cursor = hits.length ? 'pointer' : '';
      const featureId = hits[0]?.properties?.featureId;
      const nextHoveredId = typeof featureId === 'string' ? featureId : null;
      if (useEditorStore.getState().hoveredFeatureId !== nextHoveredId) {
        setHoveredFeatureId(nextHoveredId);
      }
    }

    function handleMouseOut() {
      setHoveredFeatureId(null);
    }

    map.on('style.load', handleStyleLoad);
    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      map.getCanvas().style.cursor = '';
    };
  }, [map, setSelection, setHoveredFeatureId]);

  return null;
}
