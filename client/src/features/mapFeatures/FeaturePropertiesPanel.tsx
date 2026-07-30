import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import type { FeatureType, MapFeatureDTO } from '@mapinski/shared';
import { deleteFeature, featuresQueryKey, updateFeature, type UpdateFeatureInput } from './api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { RichTextEditor } from './RichTextEditor';
import { IconPicker } from './IconPicker';
import { FEATURE_COLORS } from './colors';
import { SANITIZE_CONFIG } from './sanitizeConfig';
import {
  formatArea,
  formatAreaImperial,
  formatDistance,
  formatDistanceImperial,
  lineLengthMeters,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
} from './geometryMeasurements';

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  point: 'Pin',
  line: 'Line',
  polygon: 'Polygon',
};

function MeasurementStat({ label, metric, imperial }: { label: string; metric: string; imperial: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{metric}</Typography>
      <Typography variant="caption" color="text.secondary">
        {imperial}
      </Typography>
    </Box>
  );
}

interface FeaturePropertiesPanelProps {
  feature: MapFeatureDTO;
  layerId: string;
  onClose: () => void;
}

export function FeaturePropertiesPanel({ feature, layerId, onClose }: FeaturePropertiesPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(feature.properties.title);
  const [description, setDescription] = useState(feature.properties.descriptionHtml);

  const measurements = useMemo(() => {
    if (feature.geometry.type === 'LineString') {
      return { kind: 'line' as const, length: lineLengthMeters(feature.geometry.coordinates) };
    }
    if (feature.geometry.type === 'Polygon') {
      return {
        kind: 'polygon' as const,
        perimeter: polygonPerimeterMeters(feature.geometry.coordinates),
        area: polygonAreaSquareMeters(feature.geometry.coordinates),
      };
    }
    return null;
  }, [feature.geometry]);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateFeatureInput) => updateFeature(feature.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(layerId) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteFeature(feature.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(layerId) });
      onClose();
    },
  });

  const persistTitle = useDebouncedCallback((value: string) => {
    updateMutation.mutate({ properties: { title: value } });
  }, 500);

  const persistDescription = useDebouncedCallback((html: string) => {
    updateMutation.mutate({ properties: { descriptionHtml: DOMPurify.sanitize(html, SANITIZE_CONFIG) } });
  }, 500);

  function handleTitleChange(value: string) {
    setTitle(value);
    persistTitle(value);
  }

  function handleDescriptionChange(html: string) {
    setDescription(html);
    persistDescription(html);
  }

  const showStroke = feature.featureType !== 'point';

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
        <Typography variant="subtitle1">{FEATURE_TYPE_LABELS[feature.featureType]} details</Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close feature details">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        <TextField
          label="Title"
          size="small"
          fullWidth
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />

        {measurements && (
          <Stack direction="row" spacing={2}>
            {measurements.kind === 'line' ? (
              <MeasurementStat
                label="Length"
                metric={formatDistance(measurements.length)}
                imperial={formatDistanceImperial(measurements.length)}
              />
            ) : (
              <>
                <MeasurementStat
                  label="Perimeter"
                  metric={formatDistance(measurements.perimeter)}
                  imperial={formatDistanceImperial(measurements.perimeter)}
                />
                <MeasurementStat
                  label="Area"
                  metric={formatArea(measurements.area)}
                  imperial={formatAreaImperial(measurements.area)}
                />
              </>
            )}
          </Stack>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Description
          </Typography>
          <RichTextEditor key={feature.id} value={description} onChange={handleDescriptionChange} />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Icon
          </Typography>
          <IconPicker
            value={feature.properties.icon}
            onChange={(icon) => updateMutation.mutate({ properties: { icon } })}
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Color
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {FEATURE_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => updateMutation.mutate({ properties: { color } })}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  bgcolor: color,
                  cursor: 'pointer',
                  border: feature.properties.color === color ? '2px solid black' : '2px solid transparent',
                }}
              />
            ))}
          </Stack>
        </Box>

        {showStroke && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Stroke width
            </Typography>
            <Slider
              size="small"
              min={1}
              max={10}
              step={0.5}
              value={feature.properties.strokeWidth ?? 3}
              onChangeCommitted={(_e, value) =>
                updateMutation.mutate({ properties: { strokeWidth: value as number } })
              }
            />
          </Box>
        )}

        <Divider />

        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon fontSize="small" />}
          onClick={() => deleteMutation.mutate()}
        >
          Delete Feature
        </Button>
      </Stack>
    </Paper>
  );
}
