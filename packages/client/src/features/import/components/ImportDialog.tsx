import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { importAsNewMap, importIntoMap, extractImportErrorMessage } from '../lib/api';
import { layersQueryKey } from '../../layers/lib/api';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  mapId?: string;
}

export function ImportDialog({ open, onClose, mapId }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  const importMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('No file selected');
      return mapId ? importIntoMap(mapId, file) : importAsNewMap(file);
    },
    onSuccess: (result) => {
      if (mapId) {
        queryClient.invalidateQueries({ queryKey: layersQueryKey(mapId) });
      } else if ('mapId' in result) {
        queryClient.invalidateQueries({ queryKey: ['maps'] });
        navigate(`/maps/${result.mapId}`);
      }
      handleClose();
    },
  });

  function handleClose() {
    setFile(null);
    importMutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Import Map Data</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Upload a GeoJSON (.geojson, .json) or KML (.kml) file.
          {mapId ? ' It will be added as a new layer.' : ' It will create a new map.'}
        </Typography>
        <input
          type="file"
          accept=".geojson,.json,.kml"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {importMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {extractImportErrorMessage(importMutation.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!file || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
