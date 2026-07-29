import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { fetchMap, updateMap, type UpdateMapInput } from '../maps/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { LayerPanel } from '../layers/LayerPanel';
import { MapView, type MapViewChange } from './MapView';

export function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: map, isLoading } = useQuery({
    queryKey: ['maps', mapId],
    queryFn: () => fetchMap(mapId!),
    enabled: Boolean(mapId),
  });

  const patchMutation = useMutation({
    mutationFn: (input: UpdateMapInput) => updateMap(mapId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
    },
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
      />
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
    </Box>
  );
}
