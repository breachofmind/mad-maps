import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { FeatureType, MapFeaturePropertiesDTO } from '@mad-maps/shared';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { fetchMap, updateMap, type UpdateMapInput } from '../../lib/maps/api';
import { fetchLayers, layersQueryKey } from '../../lib/layers/api';
import { createFeature, featuresQueryKey, updateFeature } from '../../lib/mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { useEditorStore } from '../../lib/state/editorStore';
import { usePanelStore } from '../../lib/state/panelStore';
import { LayerPanel } from '../layers/LayerPanel';
import { DrawControls, DRAW_MODE_TO_EDITOR_MODE } from '../draw/DrawControls';
import { useMapboxDraw } from '../../lib/draw/useMapboxDraw';
import { RouteControls } from '../draw/RouteControls';
import { useMapboxRoute } from '../../lib/draw/useMapboxRoute';
import { formatDuration, type RouteProfile } from '../../lib/draw/mapboxDirections';
import { formatDistance } from '../../lib/mapFeatures/geometryMeasurements';
import { useUnitsStore } from '../../lib/state/unitsStore';
import { FeaturePropertiesPanel } from '../mapFeatures/FeaturePropertiesPanel';
import { BulkFeaturePropertiesPanel } from '../mapFeatures/BulkFeaturePropertiesPanel';
import { useSelectedFeatures } from '../../lib/mapFeatures/useSelectedFeatures';
import { SearchBox } from '../search/SearchBox';
import { MenuBar } from '../common/MenuBar';
import { SideBar } from '../common/SideBar';
import { MapView, type MapViewChange } from './MapView';
import { FeatureLayer, FEATURE_LAYER_Z_ORDER_IDS } from './FeatureLayer';
import { RemoteLayer, remoteLayerZOrderIds } from './RemoteLayer';
import { syncLayerZOrder } from '../../lib/map/layerZOrder';
import { FeaturePopup } from './FeaturePopup';
import { MapMenu } from './MapMenu';
import { MapTitleBar } from './MapTitleBar';
import { BaseLayerPanel } from './BaseLayerPanel';
import { AccountMenu } from '../common/AccountMenu';
import { PropertiesEmptyState } from './PropertiesEmptyState';

// Width of the fixed MenuBar (60px) + SideBar (400px) shell — the map area
// is offset by this much instead of spanning the full viewport.
const SHELL_WIDTH = 460;

// Verb suffixed onto a finished route's prefilled description (e.g. "8 min
// drive") so it reads naturally regardless of which profile was used.
const ROUTE_PROFILE_VERBS: Record<RouteProfile, string> = {
  walking: 'walk',
  cycling: 'ride',
  driving: 'drive',
};

const DEFAULT_TEXT_FONT_SIZE = 16;

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const drawMode = useEditorStore((s) => s.drawMode);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);
  const setSelection = useEditorStore((s) => s.setSelection);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const distanceUnit = useUnitsStore((s) => s.distanceUnit);
  const [routeProfile, setRouteProfile] = useState<RouteProfile>('driving');
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [accountAnchorEl, setAccountAnchorEl] = useState<HTMLElement | null>(null);

  const { data: map, isLoading } = useQuery({
    queryKey: ['maps', mapId],
    queryFn: () => fetchMap(mapId!),
    enabled: Boolean(mapId),
  });

  const { data: layers } = useQuery({
    queryKey: layersQueryKey(mapId!),
    queryFn: () => fetchLayers(mapId!),
    enabled: Boolean(mapId),
  });

  const selectedFeatures = useSelectedFeatures(layers ?? []);
  const singleSelectedFeature = selectedFeatures.length === 1 ? selectedFeatures[0] : null;
  const activeLayer = layers?.find((l) => l.id === activeLayerId) ?? null;
  const canAddFeatures = activeLayer?.sourceType === 'local';

  useEffect(() => {
    if (activeLayerId || !layers || layers.length === 0) return;
    const firstLocalLayer = layers.find((l) => l.sourceType === 'local');
    setActiveLayerId((firstLocalLayer ?? layers[0]).id);
  }, [layers, activeLayerId, setActiveLayerId]);

  // FeatureLayer and RemoteLayer each add their own Mapbox layers with no
  // regard for each other's stacking, and neither repositions existing
  // layers when orderIndex changes — this is the pass that actually makes
  // the map's draw order match the panel's layer order. Runs after both
  // children have synced for this commit (child effects fire before the
  // parent's), and again on every basemap switch, since a style reload
  // recreates every layer from scratch in their own default order.
  useEffect(() => {
    if (!mapInstance) return;
    const currentLayers = layers ?? [];
    function applyZOrder() {
      if (!mapInstance) return;
      syncLayerZOrder(mapInstance, currentLayers, FEATURE_LAYER_Z_ORDER_IDS, remoteLayerZOrderIds);
    }
    applyZOrder();
    mapInstance.on('style.load', applyZOrder);
    return () => {
      mapInstance.off('style.load', applyZOrder);
    };
  }, [mapInstance, layers]);

  const patchMutation = useMutation({
    mutationFn: (input: UpdateMapInput) => updateMap(mapId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: ({
      layerId,
      geometry,
      featureType,
      properties,
    }: {
      layerId: string;
      geometry: GeoJSON.Geometry;
      featureType?: FeatureType;
      properties?: Partial<MapFeaturePropertiesDTO>;
    }) => createFeature(layerId, { geometry, featureType, properties }),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: featuresQueryKey(variables.layerId) });
      if (variables.geometry.type === 'Point') {
        setSelection({ type: 'feature', featureIds: [result.id] });
      }
    },
  });

  const updateGeometryMutation = useMutation({
    mutationFn: ({ featureId, geometry }: { featureId: string; layerId: string; geometry: GeoJSON.Geometry }) =>
      updateFeature(featureId, { geometry }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(variables.layerId) });
    },
  });
  const updateGeometryMutationRef = useRef(updateGeometryMutation);
  updateGeometryMutationRef.current = updateGeometryMutation;

  const { setMode, editFeature, stopEditing } = useMapboxDraw({
    map: mapInstance,
    onCreate: (feature) => {
      if (!activeLayerId || !canAddFeatures || !feature.geometry) return;
      const isText = useEditorStore.getState().drawMode === 'text';
      createFeatureMutation.mutate({
        layerId: activeLayerId,
        geometry: feature.geometry,
        featureType: isText ? 'text' : undefined,
        properties: isText
          ? { color: activeLayer!.color, title: '', fontSize: DEFAULT_TEXT_FONT_SIZE }
          : { color: activeLayer!.color, icon: activeLayer!.defaultIcon },
      });
    },
    onModeChange: (mode) => {
      // 'route' has no mapbox-gl-draw equivalent (see DrawControls) — Draw
      // reports 'simple_select' when that tool is selected, which would
      // otherwise stomp the store's 'route' mode right back to 'none'.
      if (useEditorStore.getState().drawMode === 'route') return;
      setDrawMode(DRAW_MODE_TO_EDITOR_MODE[mode] ?? 'none');
    },
    onUpdateGeometry: (layerId, featureId, geometry, previousGeometry) => {
      useEditorStore.getState().pushMoveHistory({ featureId, layerId, previousGeometry });
      updateGeometryMutation.mutate({ featureId, layerId, geometry });
    },
  });

  const { waypointCount, isFetching, distanceMeters, durationSeconds, error, finish, cancel } = useMapboxRoute({
    map: mapInstance,
    active: drawMode === 'route',
    profile: routeProfile,
    onCreate: (feature) => {
      if (!activeLayerId || !canAddFeatures || !feature.geometry) return;
      const routeDistanceMeters = feature.properties?.distanceMeters as number | null | undefined;
      const routeDurationSeconds = feature.properties?.durationSeconds as number | null | undefined;
      const routeProfileUsed = feature.properties?.profile as RouteProfile | undefined;
      const summary =
        routeDistanceMeters != null && routeDurationSeconds != null
          ? `${formatDistance(routeDistanceMeters, distanceUnit)} · ${formatDuration(routeDurationSeconds)}${
              routeProfileUsed ? ` ${ROUTE_PROFILE_VERBS[routeProfileUsed]}` : ''
            }`
          : null;
      createFeatureMutation.mutate({
        layerId: activeLayerId,
        geometry: feature.geometry,
        properties: {
          color: activeLayer!.color,
          icon: activeLayer!.defaultIcon,
          ...(summary ? { descriptionHtml: `<p>${summary}</p>` } : {}),
        },
      });
      setDrawMode('none');
    },
  });

  // If the active layer changes to an external one mid-draw (e.g. the user
  // switches layers in LayerPanel while a draw/route session is in progress),
  // bail out rather than let onCreate above silently swallow the finished
  // feature — external layers can't hold local map_features.
  useEffect(() => {
    if (canAddFeatures || drawMode === 'none') return;
    setDrawMode('none');
    setMode('simple_select');
    if (drawMode === 'route') cancel();
  }, [canAddFeatures, drawMode, setDrawMode, setMode, cancel]);

  // Vertex-editing is opt-in via a toggle button in FeaturePropertiesPanel
  // (see isEditingVertices below) rather than showing automatically on
  // selection. This effect loads the selected line/polygon into
  // mapbox-gl-draw's direct_select mode while that toggle is on, and drops
  // out of edit mode the moment the selection changes to something else —
  // a fresh selection always starts out of edit mode, even if the same
  // feature is reselected later.
  const [isEditingVertices, setIsEditingVertices] = useState(false);
  // Shared across FeaturePropertiesPanel/BulkFeaturePropertiesPanel/
  // PropertiesEmptyState — they're mutually exclusive (see the Properties
  // slot below), so one lifted flag covers whichever is currently mounted.
  // Also handed to LayerPanel so it can grow its own list into the space
  // freed up when the Properties slot is collapsed — see
  // LayerPanel's externalPropertiesCollapsed prop.
  const propertiesCollapsed = usePanelStore((s) => s.collapsed.properties);
  const setPanelCollapsed = usePanelStore((s) => s.setCollapsed);
  const editingFeatureIdRef = useRef<string | null>(null);
  const lastSelectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSelectionId = singleSelectedFeature?.feature.id ?? null;
    const selectionChanged = lastSelectionIdRef.current !== currentSelectionId;
    lastSelectionIdRef.current = currentSelectionId;

    let effectiveEditing = isEditingVertices;
    if (selectionChanged && isEditingVertices) {
      effectiveEditing = false;
      setIsEditingVertices(false);
    }

    const feature =
      effectiveEditing &&
      (singleSelectedFeature?.feature.featureType === 'line' || singleSelectedFeature?.feature.featureType === 'polygon')
        ? singleSelectedFeature
        : null;
    if (feature) {
      if (editingFeatureIdRef.current !== feature.feature.id) {
        editFeature(
          { id: feature.feature.id, type: 'Feature', geometry: feature.feature.geometry, properties: {} },
          feature.layer.id,
        );
        editingFeatureIdRef.current = feature.feature.id;
      }
    } else if (editingFeatureIdRef.current !== null) {
      stopEditing();
      editingFeatureIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleSelectedFeature?.feature.id, singleSelectedFeature?.feature.featureType, isEditingVertices]);

  // Ctrl+Z undoes the most recent pin move or vertex drag, popping
  // editorStore's moveHistory stack (pushed by FeatureLayer on pin drag and by
  // onUpdateGeometry above on vertex drag) and replaying it through the same
  // PATCH used for a live drag. Skipped while actively drawing a new line —
  // that mode already binds Ctrl+Z to undoing the last placed vertex (see
  // useMapboxDraw's own handleKeyDown), and 'line' is the only DrawMode that
  // maps to that in-progress-drawing case (direct_select vertex-editing an
  // existing feature maps to 'none', so undo still works there).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z';
      if (!isUndo || useEditorStore.getState().drawMode === 'line') return;

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const entry = useEditorStore.getState().popMoveHistory();
      if (!entry) return;

      e.preventDefault();
      updateGeometryMutationRef.current.mutate({
        featureId: entry.featureId,
        layerId: entry.layerId,
        geometry: entry.previousGeometry,
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const persistViewport = useDebouncedCallback((change: MapViewChange) => {
    patchMutation.mutate({ defaultCenter: change.center, defaultZoom: change.zoom });
  }, 500);

  function handleBaseLayerChange(styleUrl: string) {
    patchMutation.mutate({ baseStyle: styleUrl });
  }

  if (isLoading || !map) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box position="relative" width="100vw" height="100vh">
      <MenuBar
        onLogoClick={() => navigate('/')}
        onDownloadClick={(e) => setMenuAnchorEl(e.currentTarget)}
        onAccountClick={(e) => setAccountAnchorEl(e.currentTarget)}
      />
      <SideBar>
        <MapTitleBar title={map.title} onSubmit={(title) => patchMutation.mutate({ title })} />
        <SearchBox map={mapInstance} activeLayer={activeLayer} />
        <BaseLayerPanel
          activeStyleUrl={map.baseStyle}
          onChange={handleBaseLayerChange}
          onManageStyles={() => navigate('/map-styles')}
        />
        <LayerPanel mapId={map.id} map={mapInstance} externalPropertiesCollapsed={propertiesCollapsed} />
        {selectedFeatures.length === 1 && singleSelectedFeature && (
          <FeaturePropertiesPanel
            key={singleSelectedFeature.feature.id}
            feature={singleSelectedFeature.feature}
            layerId={singleSelectedFeature.layer.id}
            onClose={() => setSelection(null)}
            isEditingVertices={isEditingVertices}
            onToggleEditVertices={() => setIsEditingVertices((prev) => !prev)}
            collapsed={propertiesCollapsed}
            onToggleCollapse={() => setPanelCollapsed('properties', !propertiesCollapsed)}
          />
        )}
        {selectedFeatures.length >= 2 && (
          <BulkFeaturePropertiesPanel
            key={selectedFeatures.map((f) => f.feature.id).join(',')}
            features={selectedFeatures}
            onClose={() => setSelection(null)}
            collapsed={propertiesCollapsed}
            onToggleCollapse={() => setPanelCollapsed('properties', !propertiesCollapsed)}
          />
        )}
        {selectedFeatures.length === 0 && !selectedLayerId && (
          <PropertiesEmptyState
            collapsed={propertiesCollapsed}
            onToggleCollapse={() => setPanelCollapsed('properties', !propertiesCollapsed)}
          />
        )}
      </SideBar>
      <MapMenu
        mapId={map.id}
        anchorEl={menuAnchorEl}
        onClose={() => setMenuAnchorEl(null)}
      />
      <AccountMenu anchorEl={accountAnchorEl} onClose={() => setAccountAnchorEl(null)} />

      <Box position="absolute" top={0} left={SHELL_WIDTH} width={`calc(100vw - ${SHELL_WIDTH}px)`} height="100vh">
        <MapView
          initialCenter={map.defaultCenter}
          initialZoom={map.defaultZoom}
          initialStyleUrl={map.baseStyle}
          onMoveEnd={persistViewport}
          onMapReady={setMapInstance}
        />
        <RemoteLayer map={mapInstance} layers={layers ?? []} />
        <FeatureLayer
          map={mapInstance}
          layers={layers ?? []}
          editingFeatureId={
            isEditingVertices &&
            singleSelectedFeature &&
            (singleSelectedFeature.feature.featureType === 'line' || singleSelectedFeature.feature.featureType === 'polygon')
              ? singleSelectedFeature.feature.id
              : null
          }
        />
        <FeaturePopup
          map={mapInstance}
          // Text features already render their own content directly on the
          // map (see FeatureLayer's LAYER_IDS.text) — a popup on top would
          // just duplicate it.
          feature={singleSelectedFeature?.feature.featureType === 'text' ? null : (singleSelectedFeature?.feature ?? null)}
          onClose={() => setSelection(null)}
        />
        <DrawControls setMode={setMode} disabled={!canAddFeatures} />
        {drawMode === 'route' && (
          <RouteControls
            profile={routeProfile}
            onProfileChange={setRouteProfile}
            waypointCount={waypointCount}
            isFetching={isFetching}
            distanceMeters={distanceMeters}
            durationSeconds={durationSeconds}
            error={error}
            onFinish={finish}
            onCancel={cancel}
          />
        )}
      </Box>
    </Box>
  );
}
