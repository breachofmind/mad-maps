import { useState, type DragEvent } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, MapFeatureDTO } from '@mapinski/shared';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadIcon from '@mui/icons-material/Upload';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useEditorStore } from '../../state/editorStore';
import { ImportDialog } from '../import/ImportDialog';
import { geometryAnchor } from '../map/geometryAnchor';
import { featuresQueryKey, fetchFeatures, moveFeature } from '../mapFeatures/api';
import { FEATURE_ICONS, type FeatureIconName } from '../mapFeatures/icons';
import {
  createLayer,
  deleteLayer,
  fetchLayers,
  layersQueryKey,
  reorderLayers,
  updateLayer,
  type UpdateLayerInput,
} from './api';

interface LayerPanelProps {
  mapId: string;
  map: mapboxgl.Map | null;
}

const FEATURE_SELECT_ZOOM = 14;

// Where a drag is currently hovering: either a position within the top-level
// layer list, or a position within a specific layer's feature list.
type DropIndicator = { scope: 'layers'; index: number } | { scope: { layerId: string }; index: number };

function isFeatureDrop(
  indicator: DropIndicator | null,
  layerId: string,
): indicator is { scope: { layerId: string }; index: number } {
  return indicator !== null && indicator.scope !== 'layers' && indicator.scope.layerId === layerId;
}

function DropIndicatorLine({ show }: { show: boolean }) {
  if (!show) return null;
  return <Box sx={{ borderTop: '2px dashed', borderColor: 'primary.main', mx: 1 }} />;
}

export function LayerPanel({ mapId, map }: LayerPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = layersQueryKey(mapId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const setHoveredFeatureId = useEditorStore((s) => s.setHoveredFeatureId);
  const [newLayerName, setNewLayerName] = useState('');
  const [addingLayer, setAddingLayer] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<Set<string>>(new Set());
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [draggedFeature, setDraggedFeature] = useState<{ featureId: string; layerId: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const { data: layers, isLoading } = useQuery({ queryKey, queryFn: () => fetchLayers(mapId) });

  const featureQueries = useQueries({
    queries: (layers ?? []).map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
    })),
  });

  function toggleLayerCollapsed(layerId: string) {
    setCollapsedLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }

  // The draggable element is a small handle icon, but the drag preview
  // should look like the whole row it belongs to. Passing the live row
  // element to setDragImage isn't enough — browsers can render the preview
  // influenced by the row's scrollable/overflow ancestor (this panel's
  // Paper), pulling in more than just that row. Cloning the row into a
  // detached, explicitly-sized element isolates the snapshot to exactly
  // that row's own markup.
  function setRowAsDragImage(e: DragEvent<HTMLElement>) {
    const row = e.currentTarget.parentElement;
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const clone = row.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top);
    // The browser snapshots the image synchronously during dragstart, so
    // the clone can be discarded right after.
    requestAnimationFrame(() => {
      document.body.removeChild(clone);
    });
  }

  // Hovering a row updates which gap the drop indicator line sits in, based
  // on whether the cursor is over the top or bottom half of that row.
  function updateDropIndicatorFromRow(e: DragEvent<HTMLElement>, scope: DropIndicator['scope'], rowIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    setDropIndicator({ scope, index: rowIndex + (isAfter ? 1 : 0) } as DropIndicator);
  }

  function resetDragState() {
    setDraggedLayerId(null);
    setDraggedFeature(null);
    setDropIndicator(null);
  }

  function selectFeature(feature: MapFeatureDTO) {
    setSelection({ type: 'feature', featureId: feature.id });
    if (map) {
      map.flyTo({
        center: geometryAnchor(feature.geometry),
        zoom: Math.max(map.getZoom(), FEATURE_SELECT_ZOOM),
      });
    }
  }

  const moveFeatureMutation = useMutation({
    mutationFn: ({
      featureId,
      toLayerId,
      index,
    }: {
      featureId: string;
      fromLayerId: string;
      toLayerId: string;
      index: number;
    }) => moveFeature(featureId, toLayerId, index),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(vars.fromLayerId) });
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(vars.toLayerId) });
    },
  });

  function commitDrop() {
    if (!dropIndicator) {
      resetDragState();
      return;
    }

    if (draggedLayerId && dropIndicator.scope === 'layers' && layers) {
      const ids = layers.map((l) => l.id);
      const fromIndex = ids.indexOf(draggedLayerId);
      if (fromIndex !== -1) {
        let targetIndex = dropIndicator.index;
        ids.splice(fromIndex, 1);
        if (fromIndex < targetIndex) targetIndex -= 1;
        const clamped = Math.max(0, Math.min(targetIndex, ids.length));
        ids.splice(clamped, 0, draggedLayerId);
        reorderMutation.mutate(ids);
      }
    } else if (draggedFeature && dropIndicator.scope !== 'layers') {
      moveFeatureMutation.mutate({
        featureId: draggedFeature.featureId,
        fromLayerId: draggedFeature.layerId,
        toLayerId: dropIndicator.scope.layerId,
        index: dropIndicator.index,
      });
    }
    resetDragState();
  }

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
      onDragOver={(e) => {
        // A catch-all so the cursor never flashes "not-allowed" while
        // dragging over gaps between rows that don't have their own more
        // specific handler (row handlers below still set the precise drop
        // position; this only guarantees every pixel in the panel accepts
        // the drop).
        if (draggedLayerId || draggedFeature) e.preventDefault();
      }}
      onDrop={(e) => {
        if (!draggedLayerId && !draggedFeature) return;
        e.preventDefault();
        commitDrop();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDropIndicator(null);
        }
      }}
      onMouseLeave={() => setHoveredFeatureId(null)}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" px={2} py={1.5}>
        <Typography variant="subtitle1">Layers</Typography>
        <Stack direction="row">
          <Tooltip title="Import layer from file">
            <IconButton size="small" onClick={() => setImportDialogOpen(true)} aria-label="Import layer from file">
              <UploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Add layer">
            <IconButton size="small" onClick={() => setAddingLayer(true)} aria-label="Add layer">
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={2}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <List dense disablePadding>
          {layers?.map((layer, index) => {
            const features = featureQueries[index]?.data ?? [];
            const collapsed = collapsedLayerIds.has(layer.id);
            return (
              <Box key={layer.id}>
                <DropIndicatorLine show={dropIndicator?.scope === 'layers' && dropIndicator.index === index} />
                <ListItem
                  onClick={() => setActiveLayerId(layer.id)}
                  onDragOver={(e) => {
                    if (draggedLayerId) {
                      updateDropIndicatorFromRow(e, 'layers', index);
                    } else if (draggedFeature) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      setDropIndicator({ scope: { layerId: layer.id }, index: features.length });
                    }
                  }}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: activeLayerId === layer.id ? 'action.selected' : undefined,
                    display: 'flex',
                    gap: 0.5,
                  }}
                >
                  <Box
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setRowAsDragImage(e);
                      setDraggedLayerId(layer.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={resetDragState}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Reorder ${layer.name}`}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.disabled' }}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </Box>

                  <Tooltip title={collapsed ? 'Expand layer' : 'Collapse layer'}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={collapsed ? `Expand ${layer.name}` : `Collapse ${layer.name}`}
                        disabled={features.length === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLayerCollapsed(layer.id);
                        }}
                      >
                        {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>

                  <Tooltip title={layer.visible ? 'Hide layer' : 'Show layer'}>
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
                  </Tooltip>

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

                  <Tooltip title="Move layer up">
                    <span>
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
                    </span>
                  </Tooltip>
                  <Tooltip title="Move layer down">
                    <span>
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
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete layer">
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
                  </Tooltip>
                </ListItem>

                <Collapse in={!collapsed && features.length > 0} unmountOnExit>
                  <List dense disablePadding>
                    {features.map((feature, featureIndex) => {
                      const Icon = FEATURE_ICONS[feature.properties.icon as FeatureIconName] ?? FEATURE_ICONS.marker;
                      const isSelected = selection?.featureId === feature.id;
                      return (
                        <Box key={feature.id}>
                          <DropIndicatorLine
                            show={isFeatureDrop(dropIndicator, layer.id) && dropIndicator.index === featureIndex}
                          />
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => selectFeature(feature)}
                            onDragOver={(e) => {
                              if (!draggedFeature) return;
                              updateDropIndicatorFromRow(e, { layerId: layer.id }, featureIndex);
                            }}
                            onMouseEnter={() => setHoveredFeatureId(feature.id)}
                            onMouseLeave={() => {
                              if (useEditorStore.getState().hoveredFeatureId === feature.id) setHoveredFeatureId(null);
                            }}
                            sx={{ pl: 5, py: 0.5, gap: 1 }}
                          >
                            <Box
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setRowAsDragImage(e);
                                setDraggedFeature({ featureId: feature.id, layerId: layer.id });
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={resetDragState}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Reorder ${feature.properties.title || 'feature'}`}
                              sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0 }}
                            >
                              <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                            </Box>
                            <Icon fontSize="small" sx={{ color: feature.properties.color, flexShrink: 0 }} />
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {feature.properties.title || 'Untitled'}
                            </Typography>
                          </ListItemButton>
                        </Box>
                      );
                    })}
                    <DropIndicatorLine
                      show={isFeatureDrop(dropIndicator, layer.id) && dropIndicator.index === features.length}
                    />
                  </List>
                </Collapse>
              </Box>
            );
          })}
          <DropIndicatorLine show={dropIndicator?.scope === 'layers' && dropIndicator.index === (layers?.length ?? 0)} />
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

      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        mapId={mapId}
      />
    </Paper>
  );
}
