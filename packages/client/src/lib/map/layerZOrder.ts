import type mapboxgl from 'mapbox-gl';
import type { LayerDTO } from '@mad-maps/shared';

// Repositions every layer/sublayer already on the map so Mapbox's rendering
// order (bottom-to-top) matches the user's layer-panel order (top of panel =
// topmost on the map). `layers` must be in panel order (top of panel first),
// same as what the server/client already sort by orderIndex.
//
// All local layers render through one shared Mapbox layer set (see
// FeatureLayer.tsx) — they can't be individually interleaved with remote
// layers, so the whole local block is positioned together, at the rank of
// the highest-priority (topmost-in-panel) local layer.
export function syncLayerZOrder(
  map: mapboxgl.Map,
  layers: LayerDTO[],
  localBlockIds: readonly string[],
  remoteIdsForLayer: (layerId: string) => string[],
) {
  const groups: readonly string[][] = buildZOrderGroups(layers, localBlockIds, remoteIdsForLayer);

  // Groups are ordered top-of-panel-first; process bottom-first so each
  // moveLayer(id) call (no beforeId means "move to the very top of the
  // style") leaves higher-priority groups on top once the loop finishes.
  for (let i = groups.length - 1; i >= 0; i--) {
    for (const id of groups[i]) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}

function buildZOrderGroups(
  layers: LayerDTO[],
  localBlockIds: readonly string[],
  remoteIdsForLayer: (layerId: string) => string[],
): string[][] {
  const groups: string[][] = [];
  let localGroupAdded = false;
  for (const layer of layers) {
    if (layer.sourceType === 'local') {
      if (!localGroupAdded) {
        groups.push([...localBlockIds]);
        localGroupAdded = true;
      }
      continue;
    }
    groups.push(remoteIdsForLayer(layer.id));
  }
  return groups;
}
