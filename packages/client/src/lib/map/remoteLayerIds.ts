import { REMOTE_LAYER_ID_PREFIX } from './featureLayerIds';

export function remoteSourceId(layerId: string) {
  return `${REMOTE_LAYER_ID_PREFIX}${layerId}`;
}

export function remoteSubLayerIds(layerId: string) {
  const base = remoteSourceId(layerId);
  return {
    fill: `${base}-fill`,
    outline: `${base}-outline`,
    line: `${base}-line`,
    point: `${base}-point`,
    label: `${base}-label`,
    icon: `${base}-icon`,
    // Only used for sourceType 'raster-url' — a single raster layer, unlike
    // the vector sub-layer set above (see ensureRemoteLayerAdded).
    raster: `${base}-raster`,
  };
}

// Bottom-to-top order this layer's sublayers are added in by
// ensureRemoteLayerAdded (ensureRemoteLayer.ts) — used by
// lib/map/layerZOrder.ts to reposition this layer's whole group relative to
// other layers' groups.
export function remoteLayerZOrderIds(layerId: string): string[] {
  const ids = remoteSubLayerIds(layerId);
  return [ids.raster, ids.fill, ids.outline, ids.line, ids.point, ids.icon, ids.label];
}
