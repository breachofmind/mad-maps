import { useState, type DragEvent } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { FeatureType, LayerDTO, MapFeatureDTO } from '@mapinski/shared';
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
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import PentagonIcon from '@mui/icons-material/Pentagon';
import PublicIcon from '@mui/icons-material/Public';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { useEditorStore } from '../../lib/state/editorStore';
import { geometryBounds } from '../../lib/map/geometryBounds';
import { featuresQueryKey, fetchFeatures, moveFeature } from '../../lib/mapFeatures/api';
import { FEATURE_ICONS, type FeatureIconName } from '../../lib/mapFeatures/icons';
import {
  createLayer,
  deleteLayer,
  externalLayerDataQueryKey,
  fetchExternalLayerData,
  fetchLayers,
  layersQueryKey,
  reorderLayers,
  updateLayer,
  type UpdateLayerInput,
} from '../../lib/layers/api';
import { AddExternalLayerDialog } from './AddExternalLayerDialog';
import { LayerPropertiesPanel } from './LayerPropertiesPanel';

interface LayerPanelProps {
  mapId: string;
  map: mapboxgl.Map | null;
}

// Caps how far selecting a feature zooms in — without this, a lone Point (a
// zero-size bounding box) would make fitBounds zoom in to the map's max.
const FEATURE_SELECT_MAX_ZOOM = 14;
const FEATURE_SELECT_PADDING = 64;

// Which gap within a layer's feature list a drag is currently hovering.
interface DropIndicator {
  layerId: string;
  index: number;
}

function DropIndicatorLine({ show }: { show: boolean }) {
  if (!show) return null;
  return <Box sx={{ borderTop: '2px dashed', borderColor: 'primary.main', mx: 1 }} />;
}

// Matches the icons DrawControls already uses for these tools, so the
// same shape means "point"/"line"/"polygon" everywhere in the app.
const FEATURE_TYPE_ICONS: Record<FeatureType, typeof PlaceIcon> = {
  point: PlaceIcon,
  line: TimelineIcon,
  polygon: PentagonIcon,
};
const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  point: 'Pin',
  line: 'Line',
  polygon: 'Polygon',
};

function FeatureTypeIcon({ featureType }: { featureType: FeatureType }) {
  const Icon = FEATURE_TYPE_ICONS[featureType];
  return (
    <Tooltip title={FEATURE_TYPE_LABELS[featureType]}>
      <Icon fontSize="inherit" sx={{ color: 'text.disabled', flexShrink: 0 }} />
    </Tooltip>
  );
}

export function LayerPanel({ mapId, map }: LayerPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = layersQueryKey(mapId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const hoveredFeatureId = useEditorStore((s) => s.hoveredFeatureId);
  const setHoveredFeatureId = useEditorStore((s) => s.setHoveredFeatureId);
  const [newLayerName, setNewLayerName] = useState('');
  const [addingLayer, setAddingLayer] = useState(false);
  const [addMenuAnchorEl, setAddMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [addExternalDialogOpen, setAddExternalDialogOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [collapsedLayerIds, setCollapsedLayerIds] = useState<Set<string>>(new Set());
  const [draggedFeature, setDraggedFeature] = useState<{ featureId: string; layerId: string } | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const { data: layers, isLoading } = useQuery({ queryKey, queryFn: () => fetchLayers(mapId) });

  const featureQueries = useQueries({
    queries: (layers ?? []).map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
      enabled: layer.sourceType === 'local',
    })),
  });

  const externalDataQueries = useQueries({
    queries: (layers ?? []).map((layer) => ({
      queryKey: externalLayerDataQueryKey(layer.id),
      queryFn: () => fetchExternalLayerData(layer.id),
      enabled: layer.sourceType === 'geojson-url',
      staleTime: Infinity,
    })),
  });

  const refreshExternalLayerMutation = useMutation({
    mutationFn: (layerId: string) => fetchExternalLayerData(layerId, { force: true }),
    onSuccess: (data, layerId) => {
      queryClient.setQueryData(externalLayerDataQueryKey(layerId), data);
    },
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
  function updateDropIndicatorFromRow(e: DragEvent<HTMLElement>, layerId: string, rowIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    setDropIndicator({ layerId, index: rowIndex + (isAfter ? 1 : 0) });
  }

  function resetDragState() {
    setDraggedFeature(null);
    setDropIndicator(null);
  }

  function selectFeature(feature: MapFeatureDTO) {
    setSelection({ type: 'feature', featureId: feature.id });
    setSelectedLayerId(null);
    if (map) {
      map.fitBounds(geometryBounds(feature.geometry), {
        padding: FEATURE_SELECT_PADDING,
        maxZoom: FEATURE_SELECT_MAX_ZOOM,
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
    if (draggedFeature && dropIndicator) {
      moveFeatureMutation.mutate({
        featureId: draggedFeature.featureId,
        fromLayerId: draggedFeature.layerId,
        toLayerId: dropIndicator.layerId,
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

  function handleBlankLayerClick() {
    setAddMenuAnchorEl(null);
    setAddingLayer(true);
  }

  function handleAddDataLayerClick() {
    setAddMenuAnchorEl(null);
    setAddExternalDialogOpen(true);
  }

  function selectLayer(layerId: string) {
    setActiveLayerId(layerId);
    setSelectedLayerId(layerId);
    setSelection(null);
  }

  const selectedIndex = layers?.findIndex((l) => l.id === selectedLayerId) ?? -1;
  const selectedLayer = selectedIndex !== -1 ? layers![selectedIndex] : undefined;

  return (
    <>
      <Paper
        elevation={3}
        sx={{ position: 'absolute', top: 72, right: 16, zIndex: 1, width: 360, maxHeight: '60vh', overflowY: 'auto' }}
        onDragOver={(e) => {
          // A catch-all so the cursor never flashes "not-allowed" while
          // dragging over gaps between rows that don't have their own more
          // specific handler (row handlers below still set the precise drop
          // position; this only guarantees every pixel in the panel accepts
          // the drop).
          if (draggedFeature) e.preventDefault();
        }}
        onDrop={(e) => {
          if (!draggedFeature) return;
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
          <Tooltip title="Add layer">
            <IconButton
              size="small"
              onClick={(e) => setAddMenuAnchorEl(e.currentTarget)}
              aria-label="Add layer"
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={addMenuAnchorEl} open={Boolean(addMenuAnchorEl)} onClose={() => setAddMenuAnchorEl(null)}>
            <MenuItem onClick={handleBlankLayerClick}>
              <ListItemIcon>
                <CreateNewFolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Blank layer</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleAddDataLayerClick}>
              <ListItemIcon>
                <CloudDownloadIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Add data layer…</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>

        {addingLayer && (
          <Box px={2} pb={1.5} display="flex" gap={1}>
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

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <List dense disablePadding sx={{ pb: 1.5 }}>
            {layers?.map((layer, index) => {
              const isRemote = layer.sourceType !== 'local';
              const features = featureQueries[index]?.data ?? [];
              const externalQuery = externalDataQueries[index];
              const collapsed = collapsedLayerIds.has(layer.id);
              return (
                <Box key={layer.id}>
                  <ListItem
                    onClick={() => selectLayer(layer.id)}
                    onDragOver={(e) => {
                      if (!draggedFeature) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      setDropIndicator({ layerId: layer.id, index: features.length });
                    }}
                    sx={{
                      cursor: 'pointer',
                      bgcolor:
                        activeLayerId === layer.id || selectedLayerId === layer.id ? 'action.selected' : undefined,
                      display: 'flex',
                      gap: 0.5,
                    }}
                  >
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

                    {isRemote && (
                      <Tooltip
                        title={
                          externalQuery?.isError
                            ? 'Failed to load this data source'
                            : `External data source: ${layer.sourceUrl ?? ''}`
                        }
                      >
                        <PublicIcon
                          fontSize="small"
                          sx={{ color: externalQuery?.isError ? 'error.main' : 'text.disabled', flexShrink: 0 }}
                        />
                      </Tooltip>
                    )}

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
                  </ListItem>

                  <Collapse in={!collapsed && features.length > 0} unmountOnExit>
                    <List dense disablePadding>
                      {features.map((feature, featureIndex) => {
                        const Icon = FEATURE_ICONS[feature.properties.icon as FeatureIconName] ?? FEATURE_ICONS.marker;
                        const isSelected = selection?.featureId === feature.id;
                        // Also true when the feature is hovered on the map itself (see
                        // FeatureLayer.tsx's handleMouseMove), not just this row —
                        // action.hover matches the same background a native :hover on
                        // this row would already show, so both triggers read the same.
                        const isHovered = !isSelected && hoveredFeatureId === feature.id;
                        return (
                          <Box key={feature.id}>
                            <DropIndicatorLine
                              show={dropIndicator?.layerId === layer.id && dropIndicator.index === featureIndex}
                            />
                            <ListItemButton
                              selected={isSelected}
                              onClick={() => selectFeature(feature)}
                              onDragOver={(e) => {
                                if (!draggedFeature) return;
                                updateDropIndicatorFromRow(e, layer.id, featureIndex);
                              }}
                              onMouseEnter={() => setHoveredFeatureId(feature.id)}
                              onMouseLeave={() => {
                                if (useEditorStore.getState().hoveredFeatureId === feature.id) setHoveredFeatureId(null);
                              }}
                              sx={{ pl: 5, py: 0.5, gap: 1, bgcolor: isHovered ? 'action.hover' : undefined }}
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
                              <FeatureTypeIcon featureType={feature.featureType} />
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
                        show={dropIndicator?.layerId === layer.id && dropIndicator.index === features.length}
                      />
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        )}

        <AddExternalLayerDialog
          open={addExternalDialogOpen}
          onClose={() => setAddExternalDialogOpen(false)}
          mapId={mapId}
        />
      </Paper>

      {selectedLayer && (
        <LayerPropertiesPanel
          layer={selectedLayer}
          map={map}
          canMoveUp={selectedIndex > 0}
          canMoveDown={layers != null && selectedIndex < layers.length - 1}
          isRefreshing={
            refreshExternalLayerMutation.isPending && refreshExternalLayerMutation.variables === selectedLayer.id
          }
          onMoveUp={() => move(selectedIndex, -1)}
          onMoveDown={() => move(selectedIndex, 1)}
          externalData={externalDataQueries[selectedIndex]?.data}
          onColorChange={(color) => updateMutation.mutate({ layerId: selectedLayer.id, input: { color } })}
          onDefaultIconChange={(defaultIcon) =>
            updateMutation.mutate({ layerId: selectedLayer.id, input: { defaultIcon } })
          }
          onStyleConfigChange={(styleConfig) =>
            updateMutation.mutate({ layerId: selectedLayer.id, input: { styleConfig } })
          }
          onRefresh={() => refreshExternalLayerMutation.mutate(selectedLayer.id)}
          onDelete={() => {
            deleteMutation.mutate(selectedLayer.id);
            setSelectedLayerId(null);
          }}
          onClose={() => setSelectedLayerId(null)}
        />
      )}
    </>
  );
}
