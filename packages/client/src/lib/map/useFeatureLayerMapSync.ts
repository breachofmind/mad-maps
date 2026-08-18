import { useEffect, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import { useEditorStore } from '../state/editorStore';
import { ensureFeatureIconImages, type FeatureIconRef } from './featureIconImages';
import { applyHighlight, type HighlightFadeState } from './featureLayerHighlight';
import { hoverLabelFilter } from './featureLayerFilters';
import {
  CLICKABLE_LAYER_IDS,
  FEATURE_SOURCE_ID,
  HOVER_CURSOR_SOURCE_ID,
  LAYER_IDS,
  REMOTE_LAYER_ID_PREFIX,
} from './featureLayerIds';
import { DRAW_VERTEX_LAYER_IDS, EMPTY_FEATURE_COLLECTION, EMPTY_FEATURE_IDS } from './featureLayerStyleConstants';
import { ensureFeatureLayersAdded } from './ensureFeatureLayers';

interface PointDragState {
  featureId: string;
  layerId: string;
  moved: boolean;
  previousGeometry: GeoJSON.Geometry;
}

interface MoveFeatureParams {
  featureId: string;
  layerId: string;
  lng: number;
  lat: number;
  previousGeometry: GeoJSON.Geometry;
}

interface UseFeatureLayerMapSyncOptions {
  map: mapboxgl.Map | null;
  data: GeoJSON.FeatureCollection;
  iconRefs: FeatureIconRef[];
  // Excluded from drag/vertex-cursor handling while its vertices are being
  // edited via mapbox-gl-draw's direct_select mode, which owns the cursor
  // and its own overlay for it in that state.
  editingFeatureId: string | null;
  onMoveFeature: (params: MoveFeatureParams) => void;
}

// getCanvas() returns undefined once the map has been map.remove()'d, which
// can happen before this hook's own effect cleanup runs (MapView, a sibling,
// removes the map on unmount, and React doesn't guarantee cleanup order
// across sibling components) — guard every cursor update against that.
function setMapCursor(map: mapboxgl.Map, cursor: string) {
  const canvas = map.getCanvas();
  if (canvas) canvas.style.cursor = cursor;
}

// This hook's own mousemove handler runs last among the map's listeners
// (RemoteLayer mounts first — see its own comment), so it has the final say
// on the cursor every move; it must account for a hit on an external-data
// feature itself rather than blindly clearing back to the default arrow
// over what RemoteLayer already marked as clickable.
function hoveringRemoteFeature(map: mapboxgl.Map, point: mapboxgl.Point): boolean {
  const remoteLayerIds = (map.getStyle()?.layers ?? [])
    .map((layer) => layer.id)
    .filter((id) => id.startsWith(REMOTE_LAYER_ID_PREFIX));
  if (remoteLayerIds.length === 0) return false;
  return map.queryRenderedFeatures(point, { layers: remoteLayerIds }).length > 0;
}

// Wires the local-feature Mapbox source/layers to this map instance and
// keeps them synced with `data`/`iconRefs`, surviving basemap switches (a
// 'style.load' wipes all custom sources/layers, so everything is recreated
// and re-applied on that event too). Also owns all direct mouse interaction
// with those layers: click-to-select, pin/text drag-to-move, and the hover
// highlight + hover labels/cursor that reflect the resulting hover/selection
// state back onto the map.
export function useFeatureLayerMapSync({
  map,
  data,
  iconRefs,
  editingFeatureId,
  onMoveFeature,
}: UseFeatureLayerMapSyncOptions) {
  const setSelection = useEditorStore((s) => s.setSelection);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const hoveredFeatureId = useEditorStore((s) => s.hoveredFeatureId);
  const setHoveredFeatureId = useEditorStore((s) => s.setHoveredFeatureId);
  const selectedFeatureIds = useEditorStore((s) =>
    s.selection?.type === 'feature' ? s.selection.featureIds : EMPTY_FEATURE_IDS,
  );
  // Zustand's selector above returns a fresh array reference every render —
  // derive a stable string key so the highlight effect below only re-runs
  // when membership actually changes, same pattern as dataUpdatedAt joins
  // elsewhere in this app.
  const selectedFeatureIdsKey = selectedFeatureIds.join(',');

  const dragStateRef = useRef<PointDragState | null>(null);
  // Tracks whether HOVER_CURSOR_SOURCE_ID currently holds a visible feature,
  // so handleMouseMove only calls setData when that's actually changing
  // rather than on every mousemove over empty map background.
  const cursorLabelVisibleRef = useRef(false);
  const highlightFadeStateRef = useRef<HighlightFadeState>({ renderedIds: [], fadeOutTimeoutId: null });

  const dataRef = useRef(data);
  dataRef.current = data;
  const iconRefsRef = useRef(iconRefs);
  iconRefsRef.current = iconRefs;
  const hoveredFeatureIdRef = useRef(hoveredFeatureId);
  hoveredFeatureIdRef.current = hoveredFeatureId;
  const selectedFeatureIdsRef = useRef(selectedFeatureIds);
  selectedFeatureIdsRef.current = selectedFeatureIds;
  const onMoveFeatureRef = useRef(onMoveFeature);
  onMoveFeatureRef.current = onMoveFeature;
  const editingFeatureIdRef = useRef(editingFeatureId);
  editingFeatureIdRef.current = editingFeatureId;

  useEffect(() => {
    if (!map) return;
    applyHighlight(map, hoveredFeatureId, selectedFeatureIds, highlightFadeStateRef.current);
    return () => {
      const timeoutId = highlightFadeStateRef.current.fadeOutTimeoutId;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hoveredFeatureId, selectedFeatureIdsKey]);

  // Tied to hover alone (not selection, unlike the ring/border highlight
  // above) since the label is meant as an at-a-glance hover cue, not a
  // lingering indicator of what's selected.
  useEffect(() => {
    if (!map || !map.getLayer(LAYER_IDS.hoverLabel)) return;
    map.setFilter(LAYER_IDS.hoverLabel, hoverLabelFilter(hoveredFeatureId));
  }, [map, hoveredFeatureId]);

  useEffect(() => {
    // Clear any cursor set by this hook right as editing starts, so Draw's
    // own CSS-driven cursor (see handleMouseMove's early return below) takes
    // over cleanly instead of being stuck behind a stale inline value.
    if (!map || !editingFeatureId) return;
    setMapCursor(map, '');
  }, [map, editingFeatureId]);

  useEffect(() => {
    if (!map) return;
    ensureFeatureLayersAdded(map, data);
    // Icons register (and repaint once loaded) independently of layer
    // setup, so a rasterization failure can't block the base pins/lines/
    // polygons from rendering.
    ensureFeatureIconImages(map, iconRefs).catch((err) => console.error('Failed to register feature icons', err));
  }, [map, data, iconRefs]);

  useEffect(() => {
    if (!map) return;

    function handleStyleLoad() {
      if (!map) return;
      ensureFeatureLayersAdded(map, dataRef.current);
      // ensureFeatureLayersAdded just recreated HOVER_CURSOR_SOURCE_ID
      // empty (all custom sources are gone after a style change), so the
      // JS-side "is it showing something" flag needs to match.
      cursorLabelVisibleRef.current = false;
      applyHighlight(map, hoveredFeatureIdRef.current, selectedFeatureIdsRef.current, highlightFadeStateRef.current);
      map.setFilter(LAYER_IDS.hoverLabel, hoverLabelFilter(hoveredFeatureIdRef.current));
      ensureFeatureIconImages(map, iconRefsRef.current).catch((err) =>
        console.error('Failed to register feature icons', err),
      );
    }

    // Drives HOVER_CURSOR_SOURCE_ID's single feature — the LineString/
    // Polygon counterpart to LAYER_IDS.hoverLabel's geometry-anchored,
    // Point-only label (see hoverLabelFilter).
    function setCursorLabel(targetMap: mapboxgl.Map, lngLat: mapboxgl.LngLat, title: string) {
      const source = targetMap.getSource(HOVER_CURSOR_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] },
            properties: { title },
          },
        ],
      });
      cursorLabelVisibleRef.current = true;
    }

    function clearCursorLabel(targetMap: mapboxgl.Map) {
      if (!cursorLabelVisibleRef.current) return;
      const source = targetMap.getSource(HOVER_CURSOR_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (source) source.setData(EMPTY_FEATURE_COLLECTION);
      cursorLabelVisibleRef.current = false;
    }

    // A single map-level click handler (rather than per-layer listeners) so
    // clicking empty map background reliably clears the selection too.
    // Mapbox suppresses 'click' when the gesture involved real movement, so
    // this doesn't fire (and re-select) after a pin drag.
    function handleClick(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length ? map.queryRenderedFeatures(e.point, { layers: existingLayers }) : [];
      const featureId = hits[0]?.properties?.featureId;
      if (typeof featureId === 'string') {
        setSelection({ type: 'feature', featureIds: [featureId] });
        setSelectedLayerId(null);
      } else {
        setSelection(null);
      }
    }

    // Pressing down on a pin starts a drag instead of the map's own
    // drag-to-pan; e.preventDefault() stops that default camera behavior
    // for this gesture.
    function handleMouseDown(e: mapboxgl.MapMouseEvent) {
      if (!map) return;
      const draggableLayers = [LAYER_IDS.point, LAYER_IDS.text].filter((id) => map.getLayer(id));
      if (draggableLayers.length === 0) return;
      const hits = map.queryRenderedFeatures(e.point, { layers: draggableLayers });
      const hit = hits[0];
      const featureId = hit?.properties?.featureId;
      const layerId = hit?.properties?.layerId;
      if (typeof featureId !== 'string' || typeof layerId !== 'string') return;
      const currentFeature = dataRef.current.features.find((f) => f.properties?.featureId === featureId);
      if (!currentFeature?.geometry) return;

      e.preventDefault();
      dragStateRef.current = { featureId, layerId, moved: false, previousGeometry: currentFeature.geometry };
      setMapCursor(map, 'grabbing');
    }

    // A single map-level mousemove handler (rather than per-layer
    // mouseenter/mouseleave) avoids cursor flicker where two clickable
    // layers overlap the same feature (e.g. polygon fill + outline). It
    // also drives the hover highlight (the same one the layer panel's row
    // hover uses) so hovering a feature directly on the map lights it up
    // too, and — while a pin is being dragged — repositions it directly on
    // the source for live visual feedback without touching react-query.
    function handleMouseMove(e: mapboxgl.MapMouseEvent) {
      if (!map) return;

      const dragState = dragStateRef.current;
      if (dragState) {
        dragState.moved = true;
        clearCursorLabel(map);
        const source = map.getSource(FEATURE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
        const draggedFeature = dataRef.current.features.find(
          (feature) => feature.properties?.featureId === dragState.featureId,
        );
        if (source && draggedFeature) {
          // updateData patches just this one feature (matched by its `id`
          // — see buildFeatureCollection) instead of setData's full
          // re-send/re-tile of every feature across every local layer,
          // which is what made dragging jerky on maps with many features.
          source.updateData({
            type: 'FeatureCollection',
            features: [{ ...draggedFeature, geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] } }],
          });
        }
        return;
      }

      // While a feature is being vertex-edited via mapbox-gl-draw's
      // direct_select mode, take over cursor management ourselves rather
      // than relying on Draw's own CSS-class-driven cursor (see
      // DRAW_VERTEX_LAYER_IDS for why that doesn't reliably work). Only
      // vertices get a special cursor; clearing to '' the rest of the time
      // lets Draw's own inherited styling (e.g. "move" over the feature
      // body) show through undisturbed.
      if (editingFeatureIdRef.current) {
        clearCursorLabel(map);
        const vertexLayers = DRAW_VERTEX_LAYER_IDS.filter((id) => map.getLayer(id));
        const onVertex =
          vertexLayers.length > 0 && map.queryRenderedFeatures(e.point, { layers: vertexLayers }).length > 0;
        setMapCursor(map, onVertex ? 'pointer' : '');
        return;
      }

      const existingLayers = CLICKABLE_LAYER_IDS.filter((id) => map.getLayer(id));
      const hits = existingLayers.length ? map.queryRenderedFeatures(e.point, { layers: existingLayers }) : [];
      const hit = hits[0];
      if (hit) {
        setMapCursor(map, hit.layer?.id === LAYER_IDS.point || hit.layer?.id === LAYER_IDS.text ? 'grab' : 'pointer');
      } else {
        setMapCursor(map, hoveringRemoteFeature(map, e.point) ? 'pointer' : '');
      }
      const featureId = hit?.properties?.featureId;
      const nextHoveredId = typeof featureId === 'string' ? featureId : null;
      if (useEditorStore.getState().hoveredFeatureId !== nextHoveredId) {
        setHoveredFeatureId(nextHoveredId);
      }

      // Points keep their existing geometry-anchored label (LAYER_IDS.
      // hoverLabel); LineStrings/Polygons get this cursor-following one
      // instead, since a fixed anchor can land far from the cursor on a
      // large shape.
      const title = hit?.properties?.title;
      if (
        hit &&
        hit.layer?.id !== LAYER_IDS.point &&
        hit.layer?.id !== LAYER_IDS.text &&
        typeof title === 'string' &&
        title !== ''
      ) {
        setCursorLabel(map, e.lngLat, title);
      } else {
        clearCursorLabel(map);
      }
    }

    function handleMouseUp(e: mapboxgl.MapMouseEvent) {
      const dragState = dragStateRef.current;
      if (!dragState || !map) return;
      dragStateRef.current = null;
      setMapCursor(map, 'grab');
      if (dragState.moved) {
        onMoveFeatureRef.current({
          featureId: dragState.featureId,
          layerId: dragState.layerId,
          previousGeometry: dragState.previousGeometry,
          lng: e.lngLat.lng,
          lat: e.lngLat.lat,
        });
      }
    }

    // Safety net for releasing the mouse outside the map canvas mid-drag
    // (e.g. over a floating panel), which wouldn't fire the map's own
    // mouseup — snap the pin back to its last saved position instead of
    // leaving the drag stuck.
    function handleWindowMouseUp() {
      const dragState = dragStateRef.current;
      if (!dragState) return;
      dragStateRef.current = null;
      if (map) {
        ensureFeatureLayersAdded(map, dataRef.current);
        setMapCursor(map, '');
      }
    }

    function handleMouseOut() {
      setHoveredFeatureId(null);
      if (map) clearCursorLabel(map);
    }

    map.on('style.load', handleStyleLoad);
    map.on('click', handleClick);
    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);
    map.on('mouseout', handleMouseOut);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      map.off('style.load', handleStyleLoad);
      map.off('click', handleClick);
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
      map.off('mouseout', handleMouseOut);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      setMapCursor(map, '');
    };
  }, [map, setSelection, setSelectedLayerId, setHoveredFeatureId]);
}
