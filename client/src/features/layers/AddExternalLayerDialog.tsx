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
import CircularProgress from '@mui/material/CircularProgress';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Box from '@mui/material/Box';
import { EXTERNAL_DATASETS } from './externalDatasets';
import { createLayer, deleteLayer, fetchExternalLayerData, layersQueryKey } from './api';

const CUSTOM_OPTION_ID = 'custom';

interface AddExternalLayerDialogProps {
  open: boolean;
  onClose: () => void;
  mapId: string;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AddExternalLayerDialog({ open, onClose, mapId }: AddExternalLayerDialogProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>(EXTERNAL_DATASETS[0]?.id ?? CUSTOM_OPTION_ID);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  const isCustom = selectedId === CUSTOM_OPTION_ID;
  const dataset = EXTERNAL_DATASETS.find((d) => d.id === selectedId);
  const name = isCustom ? customName.trim() : (dataset?.label ?? '');
  const url = isCustom ? customUrl.trim() : (dataset?.url ?? '');
  const canSubmit = name.length > 0 && isValidHttpUrl(url);

  const addMutation = useMutation({
    // Fetches the URL through the server right after creating the layer, as
    // a validation step — if the source is unreachable or isn't valid
    // GeoJSON, the half-created layer is rolled back rather than leaving a
    // layer behind that will never render anything.
    mutationFn: async () => {
      const layer = await createLayer(mapId, name, url);
      try {
        await fetchExternalLayerData(layer.id);
      } catch (err) {
        await deleteLayer(layer.id);
        throw err;
      }
      return layer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: layersQueryKey(mapId) });
      handleClose();
    },
  });

  function handleClose() {
    addMutation.reset();
    setCustomName('');
    setCustomUrl('');
    setSelectedId(EXTERNAL_DATASETS[0]?.id ?? CUSTOM_OPTION_ID);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Data Layer</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Overlay a public GeoJSON dataset on this map. It renders live from the source and can be toggled or
          removed like any other layer.
        </Typography>
        <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {EXTERNAL_DATASETS.map((ds) => (
            <FormControlLabel
              key={ds.id}
              value={ds.id}
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2">{ds.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ds.description}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mb: 1 }}
            />
          ))}
          <FormControlLabel value={CUSTOM_OPTION_ID} control={<Radio size="small" />} label="Custom URL" />
        </RadioGroup>

        {isCustom && (
          <Box display="flex" flexDirection="column" gap={1.5} mt={1} pl={4}>
            <TextField
              size="small"
              label="Layer name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="GeoJSON URL"
              placeholder="https://example.com/data.geojson"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              error={customUrl.trim().length > 0 && !isValidHttpUrl(customUrl.trim())}
              fullWidth
            />
          </Box>
        )}

        {addMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Couldn't load that data source. Double-check the URL and that it returns a valid GeoJSON
            FeatureCollection.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSubmit || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          startIcon={addMutation.isPending ? <CircularProgress size={16} /> : undefined}
        >
          Add Layer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
