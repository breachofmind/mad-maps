import { useEffect, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO } from '@mapinski/shared';
import { externalLayerDataQueryKey, fetchExternalLayerData } from '../layers/api';
import { RemoteFeaturePopup, type RemoteFeatureSelection } from './RemoteFeaturePopup';

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const FILL_OPACITY = 0.25;
const LINE_WIDTH = 3;
const OUTLINE_WIDTH = 2;
const POINT_RADIUS = 6;
const POINT_STROKE_WIDTH = 1.5;
const POINT_STROKE_COLOR = '#ffffff';

function sourceId(layerId: string) {
  return `mapinski-remote-${layerId}`;
}

function subLayerIds(layerId: string) {
  const base = sourceId(layerId);
  return {
    fill: `${base}-fill`,
    outline: `${base}-outline`,
    line: `${base}-line`,
    point: `${base}-point`,
  };
}

// Mapbox's `geometry-type` expression already collapses Multi* geometries
// into their singular counterpart (MultiPolygon -> 'Polygon', etc.), so no
// separate handling is needed for them here — see FeatureLayer.tsx's own
// use of the same expression for local features.
function ensureRemoteLayerAdded(map: mapboxgl.Map, layerId: string, color: string, data: GeoJSON.FeatureCollection) {
  const id = sourceId(layerId);
  const ids = subLayerIds(layerId);
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    if (map.getLayer(ids.fill)) map.setPaintProperty(ids.fill, 'fill-color', color);
    if (map.getLayer(ids.outline)) map.setPaintProperty(ids.outline, 'line-color', color);
    if (map.getLayer(ids.line)) map.setPaintProperty(ids.line, 'line-color', color);
    if (map.getLayer(ids.point)) map.setPaintProperty(ids.point, 'circle-color', color);
    return;
  }

  map.addSource(id, { type: 'geojson', data });
  map.addLayer({
    id: ids.fill,
    type: 'fill',
    source: id,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': color, 'fill-opacity': FILL_OPACITY },
  });
  map.addLayer({
    id: ids.outline,
    type: 'line',
    source: id,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': OUTLINE_WIDTH },
  });
  map.addLayer({
    id: ids.line,
    type: 'line',
    source: id,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': LINE_WIDTH },
  });
  map.addLayer({
    id: ids.point,
    type: 'circle',
    source: id,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-color': color,
      'circle-radius': POINT_RADIUS,
      'circle-stroke-color': POINT_STROKE_COLOR,
      'circle-stroke-width': POINT_STROKE_WIDTH,
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
  const remoteLayers = layers.filter((layer) => layer.sourceType === 'geojson-url');

  const dataQueries = useQueries({
    queries: remoteLayers.map((layer) => ({
      queryKey: externalLayerDataQueryKey(layer.id),
      queryFn: () => fetchExternalLayerData(layer.id),
      staleTime: Infinity,
    })),
  });

  const stateRef = useRef({ remoteLayers, dataQueries });
  stateRef.current = { remoteLayers, dataQueries };
  const knownLayerIdsRef = useRef<Set<string>>(new Set());
  const layerMetaBySubLayerRef = useRef<Map<string, { layerId: string; layerName: string; layerColor: string }>>(
    new Map(),
  );
  const [selection, setSelection] = useState<RemoteFeatureSelection | null>(null);

  useEffect(() => {
    if (!map) return;

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
        ensureRemoteLayerAdded(map, layer.id, layer.color, data);
        setRemoteLayerVisibility(map, layer.id, layer.visible);
        for (const subLayerId of Object.values(subLayerIds(layer.id))) {
          meta.set(subLayerId, { layerId: layer.id, layerName: layer.name, layerColor: layer.color });
        }
      });
      layerMetaBySubLayerRef.current = meta;
    }

    syncLayers();
    map.on('style.load', syncLayers);
    return () => {
      map.off('style.load', syncLayers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    remoteLayers.map((l) => `${l.id}:${l.name}:${l.color}:${l.visible}`).join(','),
    dataQueries.map((q) => q.dataUpdatedAt).join(','),
  ]);

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

  return <RemoteFeaturePopup map={map} selection={selection} onClose={() => setSelection(null)} />;
}
