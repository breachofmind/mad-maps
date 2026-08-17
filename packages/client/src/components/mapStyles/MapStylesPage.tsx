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
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { BaseStyle, MapStyleDTO } from '@mad-maps/shared';
import { MAP_STYLE_OPTIONS } from '../../lib/map/mapStyles';
import { normalizeMapboxStyleUrl } from '../../lib/map/mapboxStyleUrl';
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

function AddStyleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const normalized = normalizeMapboxStyleUrl(url);
  const showUrlError = url.trim().length > 0 && !normalized;

  const createMutation = useMutation({
    mutationFn: () => createMapStyle({ name: name.trim(), styleUrl: normalized! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mapStylesQueryKey() });
      handleClose();
    },
  });

  function handleClose() {
    createMutation.reset();
    setName('');
    setUrl('');
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
          disabled={!name.trim() || !normalized || createMutation.isPending}
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
