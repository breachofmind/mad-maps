import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchMap, updateMap, type UpdateMapInput } from '../maps/api';
import { fetchLayers, layersQueryKey } from '../layers/api';
import { createFeature, featuresQueryKey, updateFeature } from '../mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { useEditorStore } from '../../state/editorStore';
import { LayerPanel } from '../layers/LayerPanel';
import { DrawControls, DRAW_MODE_TO_EDITOR_MODE } from '../draw/DrawControls';
import { useMapboxDraw } from '../draw/useMapboxDraw';
import { FeaturePropertiesPanel } from '../mapFeatures/FeaturePropertiesPanel';
import { useSelectedFeature } from '../mapFeatures/useSelectedFeature';
import { SearchBox } from '../search/SearchBox';
import { MapView, type MapViewChange } from './MapView';
import { FeatureLayer } from './FeatureLayer';
import { FeaturePopup } from './FeaturePopup';
import { MapMenu } from './MapMenu';

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);
  const setSelection = useEditorStore((s) => s.setSelection);

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
    onModeChange: (mode) => setDrawMode(DRAW_MODE_TO_EDITOR_MODE[mode] ?? 'none'),
    onUpdateGeometry: (layerId, featureId, geometry) => {
      updateGeometryMutation.mutate({ featureId, layerId, geometry });
    },
  });

  // Show vertex-edit handles for the selected line/polygon by loading it
  // into mapbox-gl-draw's direct_select mode. Keyed on feature id (not the
  // whole selectedFeature object) so this doesn't re-trigger — and reset
  // the in-progress edit session — every time our own edits round-trip
  // back through the query cache.
  const editingFeatureIdRef = useRef<string | null>(null);
  useEffect(() => {
    const feature = selectedFeature?.feature.featureType !== 'point' ? selectedFeature : null;
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
  }, [selectedFeature?.feature.id, selectedFeature?.feature.featureType]);

  const persistViewport = useDebouncedCallback((change: MapViewChange) => {
    patchMutation.mutate({ defaultCenter: change.center, defaultZoom: change.zoom });
  }, 500);

  const persistStyle = useDebouncedCallback((styleUrl: string) => {
    patchMutation.mutate({ baseStyle: styleUrl });
  }, 500);

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
      <FeatureLayer
        map={mapInstance}
        layers={layers ?? []}
        editingFeatureId={
          selectedFeature && selectedFeature.feature.featureType !== 'point' ? selectedFeature.feature.id : null
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
        <Typography variant="subtitle1">{map.title}</Typography>
        <MapMenu mapId={map.id} />
      </Paper>
      <LayerPanel mapId={map.id} map={mapInstance} />
      <DrawControls setMode={setMode} disabled={!activeLayerId} />
      {selectedFeature && (
        <FeaturePropertiesPanel
          key={selectedFeature.feature.id}
          feature={selectedFeature.feature}
          layerId={selectedFeature.layer.id}
          onClose={() => setSelection(null)}
        />
      )}
    </Box>
  );
}
