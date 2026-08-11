import type mapboxgl from 'mapbox-gl';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type { LayerDTO, LayerStyleConfig } from '@mad-maps/shared';
import { IconPicker } from '../mapFeatures/IconPicker';
import { ColorSwatchInput } from '../common/ColorSwatchInput';
import { Panel, PanelHeader, PanelBody } from '../common/Panel';
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
  onDefaultIconChange: (icon: string) => void;
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
  onDefaultIconChange,
  onStyleConfigChange,
  onRefresh,
  onDelete,
  onClose,
}: LayerPropertiesPanelProps) {
  const isRemote = layer.sourceType !== 'local';

  return (
    <Panel side="left" width={360} maxHeight="75vh">
      <PanelHeader title={layer.name} onClose={onClose} closeLabel="Close layer details" />

      <PanelBody>
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

          {!isRemote && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Default pin
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <ColorSwatchInput
                  value={layer.color}
                  onChange={onColorChange}
                  ariaLabel={`Change ${layer.name} default pin color`}
                />
                <IconPicker value={layer.defaultIcon} onChange={onDefaultIconChange} />
              </Stack>
            </Box>
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
      </PanelBody>
    </Panel>
  );
}
