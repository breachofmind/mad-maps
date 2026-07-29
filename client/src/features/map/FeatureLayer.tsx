import { useEffect, useMemo, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, MapFeatureDTO } from '@mapinski/shared';
import { useEditorStore } from '../../state/editorStore';
import { featuresQueryKey, fetchFeatures } from '../mapFeatures/api';

const SOURCE_ID = 'mapinski-features';
const LAYER_IDS = {
  polygonFill: 'mapinski-features-polygon-fill',
  polygonOutline: 'mapinski-features-polygon-outline',
  line: 'mapinski-features-line',
  point: 'mapinski-features-point',
};
const CLICKABLE_LAYER_IDS = [LAYER_IDS.polygonFill, LAYER_IDS.line, LAYER_IDS.point];

interface FeatureLayerProps {
  map: mapboxgl.Map | null;
  layers: LayerDTO[];
}

function buildFeatureCollection(
  layers: LayerDTO[],
  featuresByLayer: Map<string, MapFeatureDTO[]>,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const feature of featuresByLayer.get(layer.id) ?? []) {
      features.push({
        type: 'Feature',
        id: feature.id,
        geometry: feature.geometry,
        properties: {
          featureId: feature.id,
          layerId: layer.id,
          color: feature.properties.color || layer.color,
          title: feature.properties.title,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
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
  map.addLayer({
    id: LAYER_IDS.line,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: { 'line-color': ['get', 'color'], 'line-width': 3 },
  });
  map.addLayer({
    id: LAYER_IDS.point,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 7,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
}

export function FeatureLayer({ map, layers }: FeatureLayerProps) {
  const setSelection = useEditorStore((s) => s.setSelection);

  const featureQueries = useQueries({
    queries: layers.map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
    })),
  });

  const data = useMemo(() => {
    const featuresByLayer = new Map<string, MapFeatureDTO[]>();
    layers.forEach((layer, index) => {
      featuresByLayer.set(layer.id, featureQueries[index]?.data ?? []);
    });
    return buildFeatureCollection(layers, featuresByLayer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, featureQueries.map((q) => q.dataUpdatedAt).join(',')]);

  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!map) return;
    ensureLayersAdded(map, data);
  }, [map, data]);

  useEffect(() => {
    if (!map) return;

    function handleStyleLoad() {
      if (map) ensureLayersAdded(map, dataRef.current);
    }

    function handleClick(e: mapboxgl.MapLayerMouseEvent) {
      const featureId = e.features?.[0]?.properties?.featureId;
      if (typeof featureId === 'string') {
        setSelection({ type: 'feature', featureId });
      }
    }

    map.on('style.load', handleStyleLoad);
    CLICKABLE_LAYER_IDS.forEach((layerId) => map.on('click', layerId, handleClick));

    return () => {
      map.off('style.load', handleStyleLoad);
      CLICKABLE_LAYER_IDS.forEach((layerId) => map.off('click', layerId, handleClick));
    };
  }, [map, setSelection]);

  return null;
}
