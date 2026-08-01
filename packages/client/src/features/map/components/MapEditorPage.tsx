import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchMap, updateMap, type UpdateMapInput } from '../../maps/lib/api';
import { fetchLayers, layersQueryKey } from '../../layers/lib/api';
import { createFeature, featuresQueryKey, updateFeature } from '../../mapFeatures/lib/api';
import { useDebouncedCallback } from '../../../lib/useDebouncedCallback';
import { useEditorStore } from '../../../state/editorStore';
import { LayerPanel } from '../../layers/components/LayerPanel';
import { DrawControls, DRAW_MODE_TO_EDITOR_MODE } from '../../draw/components/DrawControls';
import { useMapboxDraw } from '../../draw/lib/useMapboxDraw';
import { RouteControls } from '../../draw/components/RouteControls';
import { useMapboxRoute } from '../../draw/lib/useMapboxRoute';
import type { RouteProfile } from '../../draw/lib/mapboxDirections';
import { FeaturePropertiesPanel } from '../../mapFeatures/components/FeaturePropertiesPanel';
import { useSelectedFeature } from '../../mapFeatures/lib/useSelectedFeature';
import { SearchBox } from '../../search/components/SearchBox';
import { MapView, type MapViewChange } from './MapView';
import { FeatureLayer } from './FeatureLayer';
import { RemoteLayer } from './RemoteLayer';
import { FeaturePopup } from './FeaturePopup';
import { MapMenu } from './MapMenu';

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
  const [routeProfile, setRouteProfile] = useState<RouteProfile>('walking');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

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

  const selectedFeature = useSelectedFeature(layers ?? []);

  useEffect(() => {
    if (!activeLayerId && layers && layers.length > 0) {
      setActiveLayerId(layers[0].id);
    }
  }, [layers, activeLayerId, setActiveLayerId]);

  const patchMutation = useMutation({
    mutationFn: (input: UpdateMapInput) => updateMap(mapId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: ({ layerId, geometry }: { layerId: string; geometry: GeoJSON.Geometry }) =>
      createFeature(layerId, { geometry }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(variables.layerId) });
    },
  });

  const updateGeometryMutation = useMutation({
    mutationFn: ({ featureId, geometry }: { featureId: string; layerId: string; geometry: GeoJSON.Geometry }) =>
      updateFeature(featureId, { geometry }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(variables.layerId) });
    },
  });

  const { setMode, editFeature, stopEditing } = useMapboxDraw({
    map: mapInstance,
    onCreate: (feature) => {
      if (!activeLayerId || !feature.geometry) return;
      createFeatureMutation.mutate({ layerId: activeLayerId, geometry: feature.geometry });
    },
    onModeChange: (mode) => {
      // 'route' has no mapbox-gl-draw equivalent (see DrawControls) — Draw
      // reports 'simple_select' when that tool is selected, which would
      // otherwise stomp the store's 'route' mode right back to 'none'.
      if (useEditorStore.getState().drawMode === 'route') return;
      setDrawMode(DRAW_MODE_TO_EDITOR_MODE[mode] ?? 'none');
    },
    onUpdateGeometry: (layerId, featureId, geometry) => {
      updateGeometryMutation.mutate({ featureId, layerId, geometry });
    },
  });

  const { waypointCount, isFetching, distanceMeters, error, finish, cancel } = useMapboxRoute({
    map: mapInstance,
    active: drawMode === 'route',
    profile: routeProfile,
    onCreate: (feature) => {
      if (!activeLayerId || !feature.geometry) return;
      createFeatureMutation.mutate({ layerId: activeLayerId, geometry: feature.geometry });
      setDrawMode('none');
    },
  });

  // Vertex-editing is opt-in via a toggle button in FeaturePropertiesPanel
  // (see isEditingVertices below) rather than showing automatically on
  // selection. This effect loads the selected line/polygon into
  // mapbox-gl-draw's direct_select mode while that toggle is on, and drops
  // out of edit mode the moment the selection changes to something else —
  // a fresh selection always starts out of edit mode, even if the same
  // feature is reselected later.
  const [isEditingVertices, setIsEditingVertices] = useState(false);
  const editingFeatureIdRef = useRef<string | null>(null);
  const lastSelectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSelectionId = selectedFeature?.feature.id ?? null;
    const selectionChanged = lastSelectionIdRef.current !== currentSelectionId;
    lastSelectionIdRef.current = currentSelectionId;

    let effectiveEditing = isEditingVertices;
    if (selectionChanged && isEditingVertices) {
      effectiveEditing = false;
      setIsEditingVertices(false);
    }

    const feature = effectiveEditing && selectedFeature?.feature.featureType !== 'point' ? selectedFeature : null;
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
  }, [selectedFeature?.feature.id, selectedFeature?.feature.featureType, isEditingVertices]);

  const persistViewport = useDebouncedCallback((change: MapViewChange) => {
    patchMutation.mutate({ defaultCenter: change.center, defaultZoom: change.zoom });
  }, 500);

  const persistStyle = useDebouncedCallback((styleUrl: string) => {
    patchMutation.mutate({ baseStyle: styleUrl });
  }, 500);

  function submitTitle() {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === map?.title) return;
    patchMutation.mutate({ title: trimmed });
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
      <MapView
        initialCenter={map.defaultCenter}
        initialZoom={map.defaultZoom}
        initialStyleUrl={map.baseStyle}
        onMoveEnd={persistViewport}
        onStyleChange={persistStyle}
        onMapReady={setMapInstance}
      />
      <RemoteLayer map={mapInstance} layers={layers ?? []} />
      <FeatureLayer
        map={mapInstance}
        layers={layers ?? []}
        editingFeatureId={
          isEditingVertices && selectedFeature && selectedFeature.feature.featureType !== 'point'
            ? selectedFeature.feature.id
            : null
        }
      />
      <SearchBox map={mapInstance} activeLayerId={activeLayerId} />
      <FeaturePopup
        map={mapInstance}
        feature={selectedFeature?.feature ?? null}
        onClose={() => setSelection(null)}
      />
      <Paper
        elevation={3}
        sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1, px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <Tooltip title="Back to maps">
          <IconButton size="small" onClick={() => navigate('/')} aria-label="Back to maps">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {isEditingTitle ? (
          <TextField
            autoFocus
            size="small"
            variant="standard"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={submitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTitle();
              if (e.key === 'Escape') setIsEditingTitle(false);
            }}
          />
        ) : (
          <Typography
            variant="subtitle1"
            onDoubleClick={() => {
              setTitleValue(map.title);
              setIsEditingTitle(true);
            }}
            sx={{ cursor: 'text' }}
          >
            {map.title}
          </Typography>
        )}
        <MapMenu mapId={map.id} currentStyleUrl={map.baseStyle} />
      </Paper>
      <LayerPanel mapId={map.id} map={mapInstance} />
      <DrawControls setMode={setMode} disabled={!activeLayerId} />
      {drawMode === 'route' && (
        <RouteControls
          profile={routeProfile}
          onProfileChange={setRouteProfile}
          waypointCount={waypointCount}
          isFetching={isFetching}
          distanceMeters={distanceMeters}
          error={error}
          onFinish={finish}
          onCancel={cancel}
        />
      )}
      {selectedFeature && (
        <FeaturePropertiesPanel
          key={selectedFeature.feature.id}
          feature={selectedFeature.feature}
          layerId={selectedFeature.layer.id}
          onClose={() => setSelection(null)}
          isEditingVertices={isEditingVertices}
          onToggleEditVertices={() => setIsEditingVertices((prev) => !prev)}
        />
      )}
    </Box>
  );
}
