import { useEffect, useMemo, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO } from '@mad-maps/shared';
import { REMOTE_LAYER_ID_PREFIX } from './featureLayerIds';

const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// Samples whichever pmtiles-url tiles are currently loaded into the map's
// source cache for the given layer — a best-effort, viewport-dependent
// FeatureCollection (not the full dataset, unlike a geojson-url layer's
// server-fetched data), re-sampled whenever the source reports new tile
// data. Returns an empty collection for non-pmtiles layers or before the
// source exists.
export function usePmtilesSourceFeatures(map: mapboxgl.Map | null, layer: LayerDTO): GeoJSON.FeatureCollection {
  const isPmtiles = layer.sourceType === 'pmtiles-url';
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!map || !isPmtiles) return;
    const id = `${REMOTE_LAYER_ID_PREFIX}${layer.id}`;
    function handleSourceData(e: mapboxgl.MapSourceDataEvent) {
      if (e.sourceId === id && e.isSourceLoaded) setTick((t) => t + 1);
    }
    map.on('sourcedata', handleSourceData);
    return () => {
      map.off('sourcedata', handleSourceData);
    };
  }, [map, isPmtiles, layer.id]);

  return useMemo(() => {
    if (!map || !isPmtiles || !layer.sourceLayer) return EMPTY_FEATURE_COLLECTION;
    const id = `${REMOTE_LAYER_ID_PREFIX}${layer.id}`;
    if (!map.getSource(id)) return EMPTY_FEATURE_COLLECTION;
    const features = map.querySourceFeatures(id, { sourceLayer: layer.sourceLayer });
    return { type: 'FeatureCollection', features };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isPmtiles, layer.id, layer.sourceLayer, tick]);
}
