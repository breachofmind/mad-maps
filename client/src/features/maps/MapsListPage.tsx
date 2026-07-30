import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadIcon from '@mui/icons-material/Upload';
import { useAuth } from '../auth/useAuth';
import { ImportDialog } from '../import/ImportDialog';
import { createMap, deleteMap, fetchMaps } from './api';

const MAPS_QUERY_KEY = ['maps'];

export function MapsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: maps, isLoading } = useQuery({ queryKey: MAPS_QUERY_KEY, queryFn: fetchMaps });

  const createMutation = useMutation({
    mutationFn: createMap,
    onSuccess: (map) => {
      queryClient.invalidateQueries({ queryKey: MAPS_QUERY_KEY });
      setDialogOpen(false);
      setNewTitle('');
      navigate(`/maps/${map.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAPS_QUERY_KEY });
    },
  });

  function handleCreate() {
    if (!newTitle.trim()) return;
    createMutation.mutate({ title: newTitle.trim() });
  }

  return (
    <Box maxWidth={640} mx="auto" py={6} px={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">Your Maps</Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          {user && <Typography color="text.secondary">{user.email}</Typography>}
          <Button onClick={() => logout()}>Sign out</Button>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} mb={3}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New Map
        </Button>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setImportDialogOpen(true)}>
          Import
        </Button>
      </Stack>

      {isLoading ? (
        <CircularProgress />
      ) : maps && maps.length > 0 ? (
        <List>
          {maps.map((map) => (
            <ListItemButton
              key={map.id}
              onClick={() => navigate(`/maps/${map.id}`)}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}
            >
              <ListItemText
                primary={map.title}
                secondary={new Date(map.updatedAt).toLocaleString()}
              />
              <Tooltip title="Delete map">
                <IconButton
                  edge="end"
                  aria-label={`delete ${map.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(map.id);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}
        </List>
      ) : (
        <Typography color="text.secondary">
          You don't have any maps yet. Create one to get started.
        </Typography>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New Map</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newTitle.trim() || createMutation.isPending}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <ImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
    </Box>
  );
}
