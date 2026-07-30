import { useEffect, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, MapFeatureDTO } from '@mapinski/shared';
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
const POINT_HOVER_RADIUS = 16;
const GEOMETRY_HOVER_WIDTH = 7;
const HOVER_COLOR = '#ffffff';

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
    paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
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
    paint: { 'line-color': ['get', 'color'], 'line-width': 3 },
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
      'circle-color': 'rgba(0, 0, 0, 0)',
      'circle-stroke-width': 3,
      'circle-stroke-color': HOVER_COLOR,
    },
  });
}

export function FeatureLayer({ map, layers }: FeatureLayerProps) {
  const setSelection = useEditorStore((s) => s.setSelection);
  const hoveredFeatureId = useEditorStore((s) => s.hoveredFeatureId);

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
    // layers overlap the same feature (e.g. polygon fill + outline).
    function handleMouseMove(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: existingLayers })
        : [];
      map.getCanvas().style.cursor = hits.length ? 'pointer' : '';
    }

    map.on('style.load', handleStyleLoad);
    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.getCanvas().style.cursor = '';
    };
  }, [map, setSelection]);

  return null;
}
