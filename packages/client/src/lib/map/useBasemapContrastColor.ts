import { useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import { sampleBasemapHighlightColor } from './basemapContrast';

// Re-samples the rendered basemap for a legible highlight color and hands it
// to `onSample` — used by FeatureLayer and RemoteLayer to keep their
// hover/selection highlight colors legible against whatever basemap is
// currently showing, light or dark.
export function useBasemapContrastColor(map: mapboxgl.Map | null, onSample: (map: mapboxgl.Map, color: string) => void) {
  useEffect(() => {
    if (!map) return;

    function applyContrastColor() {
      if (!map) return;
      onSample(map, sampleBasemapHighlightColor(map));
    }

    // A style's tiles aren't guaranteed to be rendered the instant
    // 'style.load' fires, so wait for the map to actually go idle (nothing
    // left to load) before sampling it for a contrasting highlight color.
    // Re-run on every basemap switch, not just the initial style.
    function scheduleContrastUpdate() {
      map?.once('idle', applyContrastColor);
    }

    scheduleContrastUpdate();
    map.on('style.load', scheduleContrastUpdate);

    return () => {
      map.off('style.load', scheduleContrastUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
}
