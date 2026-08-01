import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { updateMap } from '../../lib/maps/api';
import { normalizeMapboxStyleUrl } from '../../lib/map/mapboxStyleUrl';

interface CustomStyleDialogProps {
  open: boolean;
  onClose: () => void;
  mapId: string;
  currentStyleUrl: string;
}

export function CustomStyleDialog({ open, onClose, mapId, currentStyleUrl }: CustomStyleDialogProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(currentStyleUrl);

  const normalized = normalizeMapboxStyleUrl(value);
  const showError = value.trim().length > 0 && !normalized;

  const saveMutation = useMutation({
    mutationFn: () => updateMap(mapId, { baseStyle: normalized! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] });
      handleClose();
    },
  });

  function handleClose() {
    saveMutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Custom Style URL</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Paste the style URL from a style you published in Mapbox Studio.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          placeholder="mapbox://styles/{username}/{style_id}"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={showError}
          helperText={showError ? 'Must be a mapbox://styles/{username}/{style_id} URL' : ' '}
        />
        {saveMutation.isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            Failed to save the custom style. Please try again.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!normalized || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
