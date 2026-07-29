import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LayerDTO } from '@mapinski/shared';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useEditorStore } from '../../state/editorStore';
import {
  createLayer,
  deleteLayer,
  fetchLayers,
  reorderLayers,
  updateLayer,
  type UpdateLayerInput,
} from './api';

interface LayerPanelProps {
  mapId: string;
}

function layersQueryKey(mapId: string) {
  return ['maps', mapId, 'layers'];
}

export function LayerPanel({ mapId }: LayerPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = layersQueryKey(mapId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const [newLayerName, setNewLayerName] = useState('');
  const [addingLayer, setAddingLayer] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { data: layers, isLoading } = useQuery({ queryKey, queryFn: () => fetchLayers(mapId) });

  function rollbackOnError(_err: unknown, _vars: unknown, context: { previous?: LayerDTO[] } | undefined) {
    if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
  }

  function invalidateOnSettled() {
    queryClient.invalidateQueries({ queryKey });
  }

  const createMutation = useMutation({
    mutationFn: (name: string) => createLayer(mapId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setAddingLayer(false);
      setNewLayerName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ layerId, input }: { layerId: string; input: UpdateLayerInput }) =>
      updateLayer(layerId, input),
    onMutate: async (vars: { layerId: string; input: UpdateLayerInput }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LayerDTO[]>(queryKey);
      if (previous) {
        queryClient.setQueryData(
          queryKey,
          previous.map((l) => (l.id === vars.layerId ? { ...l, ...vars.input } : l)),
        );
      }
      return { previous };
    },
    onError: rollbackOnError,
    onSettled: invalidateOnSettled,
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ layerId, visible }: { layerId: string; visible: boolean }) =>
      updateLayer(layerId, { visible }),
    onMutate: async (vars: { layerId: string; visible: boolean }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LayerDTO[]>(queryKey);
      if (previous) {
        queryClient.setQueryData(
          queryKey,
          previous.map((l) => (l.id === vars.layerId ? { ...l, visible: vars.visible } : l)),
        );
      }
      return { previous };
    },
    onError: rollbackOnError,
    onSettled: invalidateOnSettled,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLayer,
    onMutate: async (layerId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LayerDTO[]>(queryKey);
      if (previous) {
        queryClient.setQueryData(queryKey, previous.filter((l) => l.id !== layerId));
      }
      return { previous };
    },
    onError: rollbackOnError,
    onSettled: invalidateOnSettled,
  });

  const reorderMutation = useMutation({
    mutationFn: (layerIds: string[]) => reorderLayers(mapId, layerIds),
    onMutate: async (layerIds: string[]) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LayerDTO[]>(queryKey);
      if (previous) {
        const byId = new Map(previous.map((l) => [l.id, l]));
        queryClient.setQueryData(
          queryKey,
          layerIds.map((id, index) => ({ ...byId.get(id)!, orderIndex: index })),
        );
      }
      return { previous };
    },
    onError: rollbackOnError,
    onSettled: invalidateOnSettled,
  });

  function move(index: number, direction: -1 | 1) {
    if (!layers) return;
    const target = index + direction;
    if (target < 0 || target >= layers.length) return;
    const reordered = [...layers];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((l) => l.id));
  }

  function submitRename(layerId: string) {
    const trimmed = renameValue.trim();
    setRenamingId(null);
    if (!trimmed) return;
    updateMutation.mutate({ layerId, input: { name: trimmed } });
  }

  function submitCreate() {
    const trimmed = newLayerName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  }

  return (
    <Paper
      elevation={3}
      sx={{ position: 'absolute', top: 72, right: 16, zIndex: 1, width: 280, maxHeight: '60vh', overflowY: 'auto' }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" px={2} py={1.5}>
        <Typography variant="subtitle1">Layers</Typography>
        <IconButton size="small" onClick={() => setAddingLayer(true)} aria-label="Add layer">
          <AddIcon fontSize="small" />
        </IconButton>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <List dense disablePadding>
          {layers?.map((layer, index) => (
            <ListItem
              key={layer.id}
              onClick={() => setActiveLayerId(layer.id)}
              sx={{
                cursor: 'pointer',
                bgcolor: activeLayerId === layer.id ? 'action.selected' : undefined,
                display: 'flex',
                gap: 0.5,
              }}
            >
              <IconButton
                size="small"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisibilityMutation.mutate({ layerId: layer.id, visible: !layer.visible });
                }}
              >
                {layer.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
              </IconButton>

              {renamingId === layer.id ? (
                <TextField
                  autoFocus
                  size="small"
                  variant="standard"
                  value={renameValue}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(layer.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  sx={{ flex: 1 }}
                />
              ) : (
                <Typography
                  variant="body2"
                  sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(layer.id);
                    setRenameValue(layer.name);
                  }}
                >
                  {layer.name}
                </Typography>
              )}

              <IconButton
                size="small"
                aria-label={`Move ${layer.name} up`}
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  move(index, -1);
                }}
              >
                <ArrowUpwardIcon fontSize="inherit" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Move ${layer.name} down`}
                disabled={!layers || index === layers.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  move(index, 1);
                }}
              >
                <ArrowDownwardIcon fontSize="inherit" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Delete ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(layer.id);
                }}
              >
                <DeleteIcon fontSize="inherit" />
              </IconButton>
            </ListItem>
          ))}
        </List>
      )}

      {addingLayer && (
        <Box px={2} py={1.5} display="flex" gap={1}>
          <TextField
            autoFocus
            size="small"
            placeholder="Layer name"
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitCreate();
              if (e.key === 'Escape') setAddingLayer(false);
            }}
            fullWidth
          />
        </Box>
      )}
    </Paper>
  );
}
