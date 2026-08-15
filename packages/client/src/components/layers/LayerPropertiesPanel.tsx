import { useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { LayerDTO, LayerStyleConfig } from '@mad-maps/shared';
import { IconPicker } from '../mapFeatures/IconPicker';
import { ColorSwatchInput } from '../common/ColorSwatchInput';
import { PanelHeader, PanelBody } from '../common/Panel';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
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
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onDefaultIconChange: (icon: string) => void;
  onStyleConfigChange: (styleConfig: LayerStyleConfig) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onClose: () => void;
}

// Rendered with key={layer.id} by LayerPanel — switching the selected layer
// remounts this component, so `name`'s initial state below never goes stale.
export function LayerPropertiesPanel({
  layer,
  map,
  canMoveUp,
  canMoveDown,
  isRefreshing,
  externalData,
  onMoveUp,
  onMoveDown,
  onNameChange,
  onColorChange,
  onDefaultIconChange,
  onStyleConfigChange,
  onRefresh,
  onDelete,
  onClose,
}: LayerPropertiesPanelProps) {
  const isRemote = layer.sourceType !== 'local';
  const [name, setName] = useState(layer.name);

  const persistName = useDebouncedCallback((value: string) => {
    onNameChange(value);
  }, 500);

  function handleNameChange(value: string) {
    setName(value);
    persistName(value);
  }

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      <PanelHeader
        title={isRemote ? 'Data Layer Properties' : 'Layer Properties'}
        onClose={onClose}
        closeLabel="Close layer details"
      />

      <PanelBody>
        <Stack spacing={2}>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Move up">
              <span>
                <IconButton size="small" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Move layer up">
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton size="small" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Move layer down">
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {isRemote && layer.sourceType === 'geojson-url' && (
              <Tooltip title="Refresh data">
                <span>
                  <IconButton size="small" disabled={isRefreshing} onClick={onRefresh} aria-label="Refresh data">
                    {isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>

          {isRemote && layer.sourceUrl && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Data source
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                {layer.sourceUrl}
              </Typography>
            </Box>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <IconPicker iconOnly value={layer.defaultIcon} color={layer.color} onChange={onDefaultIconChange} />
            <TextField
              size="small"
              fullWidth
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
            />
          </Stack>

          <ColorSwatchInput
            variant="chip"
            value={layer.color}
            onChange={onColorChange}
            ariaLabel={`Change ${layer.name} color`}
          />

          {isRemote && (
            <RemoteLayerStyleControls
              layer={layer}
              map={map}
              externalData={externalData}
              onStyleConfigChange={onStyleConfigChange}
            />
          )}

          <Divider />

          <Button size="small" color="error" startIcon={<DeleteIcon fontSize="small" />} onClick={onDelete}>
            {isRemote ? 'Delete Data Layer' : 'Delete Layer'}
          </Button>
        </Stack>
      </PanelBody>
    </Box>
  );
}
