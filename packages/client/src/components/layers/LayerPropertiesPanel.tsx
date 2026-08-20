import { useState } from 'react';
import type mapboxgl from 'mapbox-gl';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { FeatureType, LayerDTO, LayerStyleConfig } from '@mad-maps/shared';
import { IconPicker } from '../mapFeatures/IconPicker';
import { ColorSwatchInput } from '../common/ColorSwatchInput';
import { PanelHeader, PanelBody } from '../common/Panel';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { RemoteLayerStyleControls } from './RemoteLayerStyleControls';
import { FEATURE_TYPE_ICONS, FEATURE_TYPE_LABELS } from '../../lib/mapFeatures/featureTypeMeta';

interface LayerPropertiesPanelProps {
  layer: LayerDTO;
  map: mapboxgl.Map | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isRefreshing: boolean;
  externalData?: GeoJSON.FeatureCollection;
  // Item counts by type for the currently-selected layer — see
  // LayerPanel's selectedLayerFeatureCounts. undefined while feature data
  // is still loading.
  featureCounts?: Partial<Record<FeatureType, number>>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onDefaultIconChange: (icon: string) => void;
  onOpacityChange: (opacity: number) => void;
  onStyleConfigChange: (styleConfig: LayerStyleConfig) => void;
  onPluginEndpointUrlChange: (pluginEndpointUrl: string | null) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  featureCounts,
  onMoveUp,
  onMoveDown,
  onNameChange,
  onColorChange,
  onDefaultIconChange,
  onOpacityChange,
  onStyleConfigChange,
  onPluginEndpointUrlChange,
  onRefresh,
  onDelete,
  onClose,
  collapsed,
  onToggleCollapse,
}: LayerPropertiesPanelProps) {
  const isRemote = layer.sourceType !== 'local';
  const isRaster = layer.sourceType === 'raster-url';
  const [name, setName] = useState(layer.name);
  const [opacity, setOpacity] = useState(layer.opacity);
  const [pluginEndpointUrl, setPluginEndpointUrl] = useState(layer.pluginEndpointUrl ?? '');

  const persistName = useDebouncedCallback((value: string) => {
    onNameChange(value);
  }, 500);

  function handleNameChange(value: string) {
    setName(value);
    persistName(value);
  }

  const persistPluginEndpointUrl = useDebouncedCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      onPluginEndpointUrlChange(null);
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      return; // incomplete/invalid while typing — wait for a valid URL or a clear
    }
    onPluginEndpointUrlChange(trimmed);
  }, 500);

  function handlePluginEndpointUrlChange(value: string) {
    setPluginEndpointUrl(value);
    persistPluginEndpointUrl(value);
  }

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        flex: collapsed ? '0 0 auto' : 1,
        minHeight: 0,
      }}
    >
      <PanelHeader
        title={isRemote ? 'Data Layer Properties' : 'Layer Properties'}
        onClose={onClose}
        closeLabel="Close layer details"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        collapseLabel="properties"
      />

      {!collapsed && <PanelBody>
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

          {featureCounts && (
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              {(Object.keys(FEATURE_TYPE_LABELS) as FeatureType[])
                .filter((type) => (featureCounts[type] ?? 0) > 0)
                .map((type) => {
                  const Icon = FEATURE_TYPE_ICONS[type];
                  const count = featureCounts[type]!;
                  return (
                    <Tooltip key={type} title={`${count} ${FEATURE_TYPE_LABELS[type]}${count === 1 ? '' : 's'}`}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Icon fontSize="inherit" sx={{ color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.secondary">
                          {count}
                        </Typography>
                      </Stack>
                    </Tooltip>
                  );
                })}
              {Object.values(featureCounts).every((count) => !count) && (
                <Typography variant="caption" color="text.secondary">
                  No items yet
                </Typography>
              )}
            </Stack>
          )}

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

          {isRaster && (
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Opacity
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(opacity * 100)}%
                </Typography>
              </Stack>
              <Slider
                size="small"
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(_e, value) => setOpacity(value as number)}
                onChangeCommitted={(_e, value) => onOpacityChange(value as number)}
                aria-label="Layer opacity"
              />
            </Box>
          )}

          {isRemote && layer.sourceType !== 'raster-url' && (
            <RemoteLayerStyleControls
              layer={layer}
              map={map}
              externalData={externalData}
              onStyleConfigChange={onStyleConfigChange}
            />
          )}

          {!isRemote && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Plugin endpoint URL
              </Typography>
              <TextField
                size="small"
                fullWidth
                type="url"
                placeholder="https://example.com/plugin"
                value={pluginEndpointUrl}
                onChange={(e) => handlePluginEndpointUrlChange(e.target.value)}
                helperText="Selecting a pin in this layer will POST its details here and show what comes back."
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
              />
            </Box>
          )}

          <Divider />

          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={onDelete}
            sx={{ alignSelf: 'flex-start' }}
          >
            {isRemote ? 'Delete Data Layer' : 'Delete Layer'}
          </Button>
        </Stack>
      </PanelBody>}
    </Box>
  );
}
