import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import type { LineStyle } from '@mapinski/shared';
import { deleteFeaturesBatch, featuresQueryKey, updateFeaturesBatch } from '../../lib/mapFeatures/api';
import { IconPicker } from './IconPicker';
import { MeasurementStat, UnitSelect, ColorSwatchRow } from './featurePropertiesShared';
import {
  AREA_UNIT_OPTIONS,
  DISTANCE_UNIT_OPTIONS,
  formatArea,
  formatDistance,
  lineLengthMeters,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
} from '../../lib/mapFeatures/geometryMeasurements';
import { useUnitsStore } from '../../lib/state/unitsStore';
import type { SelectedFeature } from '../../lib/mapFeatures/useSelectedFeatures';

const DEFAULT_STROKE_WIDTH = 3;

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

interface BulkFeaturePropertiesPanelProps {
  features: SelectedFeature[];
  onClose: () => void;
}

export function BulkFeaturePropertiesPanel({ features, onClose }: BulkFeaturePropertiesPanelProps) {
  const queryClient = useQueryClient();
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const distanceUnit = useUnitsStore((s) => s.distanceUnit);
  const setDistanceUnit = useUnitsStore((s) => s.setDistanceUnit);
  const areaUnit = useUnitsStore((s) => s.areaUnit);
  const setAreaUnit = useUnitsStore((s) => s.setAreaUnit);

  const totals = useMemo(() => {
    let totalDistance = 0;
    let totalArea = 0;
    let hasLineOrPolygon = false;
    for (const { feature } of features) {
      if (feature.geometry.type === 'LineString') {
        hasLineOrPolygon = true;
        totalDistance += lineLengthMeters(feature.geometry.coordinates);
      } else if (feature.geometry.type === 'Polygon') {
        hasLineOrPolygon = true;
        totalDistance += polygonPerimeterMeters(feature.geometry.coordinates);
        totalArea += polygonAreaSquareMeters(feature.geometry.coordinates);
      }
    }
    return hasLineOrPolygon ? { totalDistance, totalArea } : null;
  }, [features]);

  const showStroke = features.some(({ feature }) => feature.featureType !== 'point');

  function invalidateSelectedLayers() {
    const layerIds = new Set(features.map((f) => f.layer.id));
    layerIds.forEach((layerId) => queryClient.invalidateQueries({ queryKey: featuresQueryKey(layerId) }));
  }

  const updateMutation = useMutation({
    mutationFn: (properties: Parameters<typeof updateFeaturesBatch>[0]['properties']) =>
      updateFeaturesBatch({ featureIds: features.map((f) => f.feature.id), properties }),
    onSuccess: invalidateSelectedLayers,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFeaturesBatch(features.map((f) => f.feature.id)),
    onSuccess: () => {
      invalidateSelectedLayers();
      onClose();
    },
  });

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
        <Typography variant="subtitle1">{features.length} items selected</Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close bulk edit">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        {totals && (
          <Box>
            <Stack direction="row" spacing={2} mb={1}>
              <UnitSelect
                label="Distance unit"
                value={distanceUnit}
                options={DISTANCE_UNIT_OPTIONS}
                onChange={setDistanceUnit}
              />
              {totals.totalArea > 0 && (
                <UnitSelect label="Area unit" value={areaUnit} options={AREA_UNIT_OPTIONS} onChange={setAreaUnit} />
              )}
            </Stack>
            <Stack direction="row" spacing={2}>
              <MeasurementStat label="Total distance" value={formatDistance(totals.totalDistance, distanceUnit)} />
              {totals.totalArea > 0 && (
                <MeasurementStat label="Total area" value={formatArea(totals.totalArea, areaUnit)} />
              )}
            </Stack>
          </Box>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Icon
          </Typography>
          <IconPicker
            value={features[0].feature.properties.icon}
            onChange={(icon) => updateMutation.mutate({ icon })}
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Color
          </Typography>
          <ColorSwatchRow value={null} onSelect={(color) => updateMutation.mutate({ color })} />
        </Box>

        {showStroke && (
          <>
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Stroke width
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {strokeWidth}px
                </Typography>
              </Stack>
              <Slider
                size="small"
                min={1}
                max={10}
                step={0.5}
                value={strokeWidth}
                onChange={(_e, value) => setStrokeWidth(value as number)}
                onChangeCommitted={(_e, value) => updateMutation.mutate({ strokeWidth: value as number })}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Line style
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={null}
                onChange={(_e, next: LineStyle | null) => {
                  if (next) updateMutation.mutate({ lineStyle: next });
                }}
              >
                {LINE_STYLE_OPTIONS.map((option) => (
                  <ToggleButton key={option.value} value={option.value}>
                    {option.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          </>
        )}

        <Divider />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon fontSize="small" />}
          onClick={() => deleteMutation.mutate()}
        >
          Delete {features.length} features
        </Button>
      </Stack>
    </Paper>
  );
}
