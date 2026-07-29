import { useEffect, useRef } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type mapboxgl from 'mapbox-gl';

export type DrawToolMode = 'simple_select' | 'draw_point' | 'draw_line_string' | 'draw_polygon';

interface UseMapboxDrawOptions {
  map: mapboxgl.Map | null;
  onCreate: (feature: GeoJSON.Feature) => void;
  onModeChange?: (mode: DrawToolMode) => void;
}

export function useMapboxDraw({ map, onCreate, onModeChange }: UseMapboxDrawOptions) {
  const drawRef = useRef<MapboxDraw | null>(null);
  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;

  useEffect(() => {
    if (!map) return;

    const draw = new MapboxDraw({ displayControlsDefault: false });
    map.addControl(draw);
    drawRef.current = draw;

    function handleCreate(e: { features: GeoJSON.Feature[] }) {
      for (const feature of e.features) {
        onCreateRef.current(feature);
        if (feature.id !== undefined) draw.delete(String(feature.id));
      }
    }

    function handleModeChange(e: { mode: string }) {
      onModeChangeRef.current?.(e.mode as DrawToolMode);
    }

    map.on('draw.create', handleCreate);
    map.on('draw.modechange', handleModeChange);

    return () => {
      map.off('draw.create', handleCreate);
      map.off('draw.modechange', handleModeChange);
      map.removeControl(draw);
      drawRef.current = null;
    };
  }, [map]);

  function setMode(mode: DrawToolMode) {
    const draw = drawRef.current;
    if (!draw) return;
    // changeMode's overloads require a literal argument per mode, so a
    // union-typed variable needs to be narrowed via switch rather than
    // passed straight through.
    switch (mode) {
      case 'simple_select':
        draw.changeMode('simple_select');
        break;
      case 'draw_point':
        draw.changeMode('draw_point');
        break;
      case 'draw_line_string':
        draw.changeMode('draw_line_string');
        break;
      case 'draw_polygon':
        draw.changeMode('draw_polygon');
        break;
    }
  }

  return { setMode };
}
