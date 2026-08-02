import type mapboxgl from 'mapbox-gl';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { LayerDTO, LayerStyleConfig } from '@mapinski/shared';
import { RemoteLayerStyleControls } from './RemoteLayerStyleControls';

interface LayerPropertiesPanelProps {
  layer: LayerDTO;
  map: mapboxgl.Map | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isRefreshing: boolean;
  externalData?: GeoJSON.FeatureCollection;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onColorChange: (color: string) => void;
  onStyleConfigChange: (styleConfig: LayerStyleConfig) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function LayerPropertiesPanel({
  layer,
  map,
  canMoveUp,
  canMoveDown,
  isRefreshing,
  externalData,
  onMoveUp,
  onMoveDown,
  onColorChange,
  onStyleConfigChange,
  onRefresh,
  onDelete,
  onClose,
}: LayerPropertiesPanelProps) {
  const isRemote = layer.sourceType !== 'local';

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 1,
        width: 360,
        maxHeight: '75vh',
        overflowY: 'auto',
        p: 2,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle1" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {layer.name}
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close layer details">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        {isRemote && (
          <RemoteLayerStyleControls
            layer={layer}
            map={map}
            isRefreshing={isRefreshing}
            externalData={externalData}
            onColorChange={onColorChange}
            onStyleConfigChange={onStyleConfigChange}
            onRefresh={onRefresh}
          />
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Order
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              disabled={!canMoveUp}
              startIcon={<ArrowUpwardIcon fontSize="small" />}
              onClick={onMoveUp}
            >
              Move up
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canMoveDown}
              startIcon={<ArrowDownwardIcon fontSize="small" />}
              onClick={onMoveDown}
            >
              Move down
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Button size="small" color="error" startIcon={<DeleteIcon fontSize="small" />} onClick={onDelete}>
          Delete Layer
        </Button>
      </Stack>
    </Paper>
  );
}
