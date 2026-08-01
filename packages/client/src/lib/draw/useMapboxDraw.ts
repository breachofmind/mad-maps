import { useEffect, useRef } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '../../components/draw/mapboxDrawOverrides.css';
import type mapboxgl from 'mapbox-gl';
import { DRAW_STYLES } from './drawTheme';

export type DrawToolMode = 'simple_select' | 'draw_point' | 'draw_line_string' | 'draw_polygon';

interface EditingState {
  featureId: string;
  layerId: string;
}

interface UseMapboxDrawOptions {
  map: mapboxgl.Map | null;
  onCreate: (feature: GeoJSON.Feature) => void;
  onModeChange?: (mode: DrawToolMode) => void;
  // Fired when dragging a vertex of a feature currently being edited via
  // editFeature() finishes (mapbox-gl-draw's direct_select mode).
  onUpdateGeometry?: (layerId: string, featureId: string, geometry: GeoJSON.Geometry) => void;
}

export function useMapboxDraw({ map, onCreate, onModeChange, onUpdateGeometry }: UseMapboxDrawOptions) {
  const drawRef = useRef<MapboxDraw | null>(null);
  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  const onUpdateGeometryRef = useRef(onUpdateGeometry);
  onUpdateGeometryRef.current = onUpdateGeometry;
  const editingRef = useRef<EditingState | null>(null);

  useEffect(() => {
    if (!map) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      // trash:true is required so mapbox-gl-draw's own keydown handler
      // treats Backspace/Delete as active (it checks this same flag) —
      // that's what lets deleting a selected vertex work. It also makes
      // Draw render its own floating trash button, which we hide via
      // mapboxDrawOverrides.css since we have our own toolbar.
      controls: { trash: true },
      styles: DRAW_STYLES,
    });
    map.addControl(draw);
    drawRef.current = draw;

    function handleCreate(e: { features: GeoJSON.Feature[] }) {
      for (const feature of e.features) {
        onCreateRef.current(feature);
        if (feature.id !== undefined) draw.delete(String(feature.id));
      }
    }

    // Fired by direct_select mode when a vertex drag completes.
    function handleUpdate(e: { features: GeoJSON.Feature[] }) {
      const editing = editingRef.current;
      if (!editing) return;
      for (const feature of e.features) {
        if (feature.id !== undefined && String(feature.id) === editing.featureId && feature.geometry) {
          onUpdateGeometryRef.current?.(editing.layerId, editing.featureId, feature.geometry);
        }
      }
    }

    function handleModeChange(e: { mode: string }) {
      onModeChangeRef.current?.(e.mode as DrawToolMode);
    }

    // mapbox-gl-draw has no built-in "undo last vertex" — Backspace/Delete
    // during draw_line_string deletes the *whole* in-progress line via its
    // trash binding, not just the last point. Rebuilding the line via the
    // documented "continue an existing LineString" entry point
    // (changeMode('draw_line_string', { featureId, from })) achieves a real
    // undo using only public APIs, without reaching into the mode's private
    // per-drag state.
    function handleKeyDown(e: KeyboardEvent) {
      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      if (!isUndo || draw.getMode() !== 'draw_line_string') return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const feature = draw.getAll().features[0];
      if (!feature || feature.geometry?.type !== 'LineString' || feature.id === undefined) return;

      e.preventDefault();

      // Coordinates are [...committed clicks, a trailing point that just
      // tracks the cursor]. Dropping the last two collapses the most
      // recent click and leaves the tracking point implicit again.
      const coords = feature.geometry.coordinates;
      if (coords.length <= 2) {
        draw.deleteAll();
        draw.changeMode('draw_line_string');
        return;
      }

      const remaining = coords.slice(0, -2);
      const from = remaining[remaining.length - 1];
      const featureId = String(feature.id);
      draw.add({
        id: featureId,
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: remaining },
      });
      draw.changeMode('draw_line_string', { featureId, from });
    }

    // Belt-and-suspenders beyond the explicit restoreDragPan() calls below:
    // direct_select's own onStop doesn't restore dragPan if a drag was
    // mid-gesture when the mode exits, and Draw can exit that mode on its
    // own (e.g. clicking empty space) before our React state — and the
    // editFeature/stopEditing calls that key off it — catches up. Checking
    // Draw's actual current mode rather than our own tracking catches that
    // gap too.
    function handleWindowMouseUp() {
      if (map && draw.getMode() !== 'direct_select' && !map.dragPan.isEnabled()) {
        map.dragPan.enable();
      }
    }

    map.on('draw.create', handleCreate);
    map.on('draw.update', handleUpdate);
    map.on('draw.modechange', handleModeChange);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      map.off('draw.create', handleCreate);
      map.off('draw.update', handleUpdate);
      map.off('draw.modechange', handleModeChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      map.removeControl(draw);
      drawRef.current = null;
    };
  }, [map]);

  // direct_select's own onStop doesn't restore map.dragPan if a vertex/
  // feature drag was mid-gesture when the mode exits (its cleanup for that
  // normally runs on mouseup, which draw.deleteAll() bypasses entirely) —
  // so forcibly abandoning an edit session can leave panning stuck
  // disabled. Nothing else in this app touches dragPan, so it's always
  // safe to force it back on wherever we tear down an edit session.
  function restoreDragPan() {
    map?.dragPan.enable();
  }

  function setMode(mode: DrawToolMode) {
    const draw = drawRef.current;
    if (!draw) return;
    if (editingRef.current) {
      draw.deleteAll();
      editingRef.current = null;
      restoreDragPan();
    }
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

  // Loads an existing LineString/Polygon feature into Draw and switches to
  // direct_select, showing draggable vertex/midpoint handles for it.
  function editFeature(feature: GeoJSON.Feature & { id: string }, layerId: string) {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    restoreDragPan();
    draw.add(feature);
    draw.changeMode('direct_select', { featureId: feature.id });
    editingRef.current = { featureId: feature.id, layerId };
  }

  function stopEditing() {
    const draw = drawRef.current;
    if (!draw || !editingRef.current) return;
    draw.deleteAll();
    draw.changeMode('simple_select');
    editingRef.current = null;
    restoreDragPan();
  }

  return { setMode, editFeature, stopEditing };
}
