import { useEffect, useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { RemoteSubLayerMeta } from './useRemoteLayerSync';
import type { RemoteFeatureSelection } from '../../components/map/RemoteFeaturePopup';

// Click-to-inspect: tracks whichever external feature was clicked, resolving
// the hit sub-layer id back to its owning layer via `layerMetaBySubLayer`
// (kept live by useRemoteLayerSync). Independent of FeatureLayer's own click
// handling for local features (the two overlays don't otherwise interact).
export function useRemoteLayerClickSelection(
  map: mapboxgl.Map | null,
  layerMetaBySubLayer: { current: Map<string, RemoteSubLayerMeta> },
) {
  const [selection, setSelection] = useState<RemoteFeatureSelection | null>(null);

  useEffect(() => {
    if (!map) return;

    function queryableLayers(): string[] {
      return [...layerMetaBySubLayer.current.keys()].filter((id) => map!.getLayer(id));
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
      const meta = layerMetaBySubLayer.current.get(hit.layer.id);
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
  }, [map, layerMetaBySubLayer]);

  return [selection, setSelection] as const;
}
