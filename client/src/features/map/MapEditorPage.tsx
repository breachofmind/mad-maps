import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchMap, updateMap, type UpdateMapInput } from '../maps/api';
import { fetchLayers, layersQueryKey } from '../layers/api';
import { createFeature, featuresQueryKey } from '../mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { useEditorStore } from '../../state/editorStore';
import { LayerPanel } from '../layers/LayerPanel';
import { DrawControls, DRAW_MODE_TO_EDITOR_MODE } from '../draw/DrawControls';
import { useMapboxDraw } from '../draw/useMapboxDraw';
import { MapView, type MapViewChange } from './MapView';
import { FeatureLayer } from './FeatureLayer';

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);

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

  const { setMode } = useMapboxDraw({
    map: mapInstance,
    onCreate: (feature) => {
      if (!activeLayerId || !feature.geometry) return;
      createFeatureMutation.mutate({ layerId: activeLayerId, geometry: feature.geometry });
    },
    onModeChange: (mode) => setDrawMode(DRAW_MODE_TO_EDITOR_MODE[mode] ?? 'none'),
  });

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
      <FeatureLayer map={mapInstance} layers={layers ?? []} />
      <Paper
        elevation={3}
        sx={{ position: 'absolute', top: 16, left: 16, zIndex: 1, px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <IconButton size="small" onClick={() => navigate('/')} aria-label="Back to maps">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="subtitle1">{map.title}</Typography>
      </Paper>
      <LayerPanel mapId={map.id} />
      <DrawControls setMode={setMode} disabled={!activeLayerId} />
    </Box>
  );
}
