import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { BaseStyle, MapStyleDTO } from '@mad-maps/shared';
import { MAP_STYLE_OPTIONS } from '../../lib/map/mapStyles';
import { normalizeMapboxStyleUrl } from '../../lib/map/mapboxStyleUrl';
import { buildRasterTileStyle } from '../../lib/map/rasterTileStyle';
import { staticPreviewUrl } from '../../lib/mapStyles/staticPreview';
import {
  createMapStyle,
  deleteMapStyle,
  fetchMapStyles,
  mapStylesQueryKey,
} from '../../lib/mapStyles/api';

function StyleCard({
  label,
  styleUrl,
  onDelete,
}: {
  label: string;
  styleUrl: BaseStyle;
  onDelete?: () => void;
}) {
  const previewUrl = staticPreviewUrl(styleUrl);

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        sx={{
          height: 120,
          bgcolor: 'action.hover',
          backgroundImage: previewUrl ? `url(${previewUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1 }}>
        <Typography variant="body2" noWrap title={label}>
          {label}
        </Typography>
        {onDelete && (
          <Tooltip title="Delete style">
            <IconButton size="small" aria-label={`delete ${label}`} onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}

type AddStyleMode = 'mapbox' | 'raster';

function AddStyleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AddStyleMode>('mapbox');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tileUrl, setTileUrl] = useState('');
  const [attribution, setAttribution] = useState('');
  const [maxZoomInput, setMaxZoomInput] = useState('');

  const normalizedMapboxUrl = normalizeMapboxStyleUrl(url);
  const parsedMaxZoom = maxZoomInput.trim() === '' ? undefined : Number(maxZoomInput);
  const maxZoomInvalid =
    maxZoomInput.trim() !== '' &&
    (!Number.isInteger(parsedMaxZoom) || parsedMaxZoom! < 0 || parsedMaxZoom! > 24);
  const rasterStyle = maxZoomInvalid ? null : buildRasterTileStyle(tileUrl, attribution, parsedMaxZoom);
  const resolvedStyle: BaseStyle | null = mode === 'mapbox' ? normalizedMapboxUrl : rasterStyle;

  const showUrlError = mode === 'mapbox' && url.trim().length > 0 && !normalizedMapboxUrl;
  const showTileUrlError =
    mode === 'raster' && tileUrl.trim().length > 0 && !buildRasterTileStyle(tileUrl, attribution);

  const createMutation = useMutation({
    mutationFn: () => createMapStyle({ name: name.trim(), styleUrl: resolvedStyle! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mapStylesQueryKey() });
      handleClose();
    },
  });

  function handleClose() {
    createMutation.reset();
    setMode('mapbox');
    setName('');
    setUrl('');
    setTileUrl('');
    setAttribution('');
    setMaxZoomInput('');
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Add Map Style</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_, next: AddStyleMode | null) => next && setMode(next)}
          sx={{ mt: 1, mb: 0.5 }}
        >
          <ToggleButton value="mapbox">Mapbox Style</ToggleButton>
          <ToggleButton value="raster">Raster Tiles</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'mapbox' ? (
          <TextField
            fullWidth
            margin="dense"
            label="Style URL"
            placeholder="mapbox://styles/{username}/{style_id}"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={showUrlError}
            helperText={showUrlError ? 'Must be a mapbox://styles/{username}/{style_id} URL' : ' '}
          />
        ) : (
          <>
            <TextField
              fullWidth
              margin="dense"
              label="Tile URL"
              placeholder="https://example.com/tiles/{z}/{y}/{x}"
              value={tileUrl}
              onChange={(e) => setTileUrl(e.target.value)}
              error={showTileUrlError}
              helperText={showTileUrlError ? 'Must be a URL containing {z}, {x}, and {y}' : ' '}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Attribution (optional)"
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
            />
            <TextField
              fullWidth
              margin="dense"
              type="number"
              label="Max Zoom (optional)"
              placeholder="16"
              value={maxZoomInput}
              onChange={(e) => setMaxZoomInput(e.target.value)}
              error={maxZoomInvalid}
              helperText={
                maxZoomInvalid
                  ? 'Must be a whole number from 0 to 24'
                  : 'Highest zoom this tile service actually has coverage at — leave blank if unsure. Cached tile services often have inconsistent coverage past a certain zoom, causing 404s; setting this stretches the last available tile instead of requesting missing ones.'
              }
            />
          </>
        )}
        {createMutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            Failed to save the style. Please try again.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || !resolvedStyle || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function MapStylesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: styles, isLoading } = useQuery({
    queryKey: mapStylesQueryKey(),
    queryFn: fetchMapStyles,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMapStyle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mapStylesQueryKey() });
    },
  });

  const gridSx = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 2,
  };

  return (
    <Box maxWidth={960} mx="auto" py={6} px={2}>
      <Stack direction="row" alignItems="center" spacing={1} mb={4}>
        <IconButton aria-label="Back to your maps" onClick={() => navigate('/')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Map Styles</Typography>
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">My Styles</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddDialogOpen(true)}>
          Add Style
        </Button>
      </Stack>

      {isLoading ? (
        <CircularProgress />
      ) : styles && styles.length > 0 ? (
        <Box sx={{ ...gridSx, mb: 5 }}>
          {styles.map((style: MapStyleDTO) => (
            <StyleCard
              key={style.id}
              label={style.name}
              styleUrl={style.styleUrl}
              onDelete={() => deleteMutation.mutate(style.id)}
            />
          ))}
        </Box>
      ) : (
        <Typography color="text.secondary" mb={5}>
          You haven't added any custom styles yet.
        </Typography>
      )}

      <Typography variant="h6" mb={2}>
        Default Styles
      </Typography>
      <Box sx={gridSx}>
        {MAP_STYLE_OPTIONS.map((option) => (
          <StyleCard key={option.id} label={option.label} styleUrl={option.style} />
        ))}
      </Box>

      <AddStyleDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} />
    </Box>
  );
}
