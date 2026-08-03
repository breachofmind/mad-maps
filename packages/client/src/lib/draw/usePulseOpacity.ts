import { useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';

// Mapbox GL JS renders line layers to a WebGL canvas, not as DOM elements —
// there's nothing for CSS to animate. This leans on mapbox's own paint-
// property transition system to do the actual fading, though: the JS here
// only has to flip 'line-opacity' between two values on an interval: the
// transition (set once below) smooths every step into a continuous pulse
// rather than this needing to compute intermediate frames by hand.
const PULSE_MIN_OPACITY = 0.50;
const PULSE_MAX_OPACITY = 1;
// Also the transition duration, so each opacity flip fades over exactly one
// half-cycle rather than snapping instantly and waiting.
const PULSE_HALF_CYCLE_MS = 300;

// Pulses one or more line layers' opacity in lockstep. Accepts multiple ids
// because mapbox-gl-draw's hot/cold layer split (see drawTheme.ts's
// GL_DRAW_LINES_*_LAYER_ID comment) can render the same in-progress feature
// through either layer — pulsing only one could leave the other showing a
// second, static copy whenever the feature lands there.
//
// Only runs while `active`. Checks map.getLayer() before each call rather
// than assuming a layer stays present for the effect's whole lifetime,
// since callers may re-add their layers after events this hook doesn't
// know about (e.g. a basemap style switch).
export function usePulseOpacity(map: mapboxgl.Map | null, active: boolean, layerIds: string | string[]) {
  const layerIdsKey = Array.isArray(layerIds) ? layerIds.join(',') : layerIds;

  useEffect(() => {
    if (!map || !active) return;
    // Captured so the nested closures below (called later, outside this
    // narrowing scope) still see `map` as non-null.
    const currentMap = map;
    const ids = layerIdsKey.split(',');

    for (const id of ids) {
      if (currentMap.getLayer(id)) {
        currentMap.setPaintProperty(id, 'line-opacity-transition', { duration: PULSE_HALF_CYCLE_MS, delay: 0 });
      }
    }

    let showingMax = false;
    function pulse() {
      showingMax = !showingMax;
      const value = showingMax ? PULSE_MAX_OPACITY : PULSE_MIN_OPACITY;
      for (const id of ids) {
        if (currentMap.getLayer(id)) currentMap.setPaintProperty(id, 'line-opacity', value);
      }
    }
    pulse();
    const intervalId = window.setInterval(pulse, PULSE_HALF_CYCLE_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const id of ids) {
        if (!currentMap.getLayer(id)) continue;
        // Back to fully opaque and an instant (non-animated) transition, so
        // the layer's normal, non-pulsing appearance doesn't inherit a fade
        // the next time something else touches its opacity.
        currentMap.setPaintProperty(id, 'line-opacity', PULSE_MAX_OPACITY);
        currentMap.setPaintProperty(id, 'line-opacity-transition', { duration: 0, delay: 0 });
      }
    };
  }, [map, active, layerIdsKey]);
}
