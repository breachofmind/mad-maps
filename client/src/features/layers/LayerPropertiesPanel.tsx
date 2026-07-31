import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { LayerDTO } from '@mapinski/shared';

interface LayerPropertiesPanelProps {
  layer: LayerDTO;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isRefreshing: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onColorChange: (color: string) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function LayerPropertiesPanel({
  layer,
  canMoveUp,
  canMoveDown,
  isRefreshing,
  onMoveUp,
  onMoveDown,
  onColorChange,
  onRefresh,
  onDelete,
  onClose,
}: LayerPropertiesPanelProps) {
  const isRemote = layer.sourceType === 'geojson-url';

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 72,
        left: 16,
        zIndex: 1,
        width: 320,
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
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Color
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                component="input"
                type="color"
                value={layer.color}
                onChange={(e) => onColorChange(e.target.value)}
                aria-label={`Change ${layer.name} color`}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0,
                  border: 'none',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  '&::-webkit-color-swatch-wrapper': { p: 0 },
                  '&::-webkit-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
                  '&::-moz-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
                }}
              />
              <Typography variant="body2" color="text.secondary">
                {layer.color}
              </Typography>
            </Stack>
          </Box>
        )}

        {isRemote && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Data source
            </Typography>
            {layer.sourceUrl && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, wordBreak: 'break-all' }}
              >
                {layer.sourceUrl}
              </Typography>
            )}
            <Button
              size="small"
              variant="outlined"
              disabled={isRefreshing}
              startIcon={isRefreshing ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
              onClick={onRefresh}
            >
              Refresh data
            </Button>
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
    </Paper>
  );
}
