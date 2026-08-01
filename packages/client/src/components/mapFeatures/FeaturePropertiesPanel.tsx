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
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PolylineIcon from '@mui/icons-material/Polyline';
import type { FeatureType, LineStyle, MapFeatureDTO } from '@mapinski/shared';
import { deleteFeature, featuresQueryKey, updateFeature, type UpdateFeatureInput } from '../../lib/mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { RichTextEditor } from './RichTextEditor';
import { IconPicker } from './IconPicker';
import { FEATURE_COLORS, normalizeHexColor } from '../../lib/mapFeatures/colors';
import { SANITIZE_CONFIG } from '../../lib/mapFeatures/sanitizeConfig';
import {
  AREA_UNIT_OPTIONS,
  DISTANCE_UNIT_OPTIONS,
  formatArea,
  formatCoordinates,
  formatDistance,
  lineLengthMeters,
  polygonAreaSquareMeters,
  polygonPerimeterMeters,
} from '../../lib/mapFeatures/geometryMeasurements';
import { useUnitsStore } from '../../lib/state/unitsStore';

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  point: 'Pin',
  line: 'Line',
  polygon: 'Polygon',
};

const DEFAULT_STROKE_WIDTH = 3;

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

function MeasurementStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

function UnitSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <FormControl size="small" variant="standard" sx={{ minWidth: 130 }}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

interface FeaturePropertiesPanelProps {
  feature: MapFeatureDTO;
  layerId: string;
  onClose: () => void;
  isEditingVertices: boolean;
  onToggleEditVertices: () => void;
}

export function FeaturePropertiesPanel({
  feature,
  layerId,
  onClose,
  isEditingVertices,
  onToggleEditVertices,
}: FeaturePropertiesPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(feature.properties.title);
  const [description, setDescription] = useState(feature.properties.descriptionHtml);
  const [strokeWidth, setStrokeWidth] = useState(feature.properties.strokeWidth ?? DEFAULT_STROKE_WIDTH);
  const [colorText, setColorText] = useState(feature.properties.color);
  const distanceUnit = useUnitsStore((s) => s.distanceUnit);
  const setDistanceUnit = useUnitsStore((s) => s.setDistanceUnit);
  const areaUnit = useUnitsStore((s) => s.areaUnit);
  const setAreaUnit = useUnitsStore((s) => s.setAreaUnit);

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

  const coordinates = feature.geometry.type === 'Point' ? formatCoordinates(feature.geometry.coordinates) : null;

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

  function selectColor(color: string) {
    setColorText(color);
    updateMutation.mutate({ properties: { color } });
  }

  function commitColorText() {
    const normalized = normalizeHexColor(colorText);
    if (normalized) {
      selectColor(normalized);
    } else {
      setColorText(feature.properties.color);
    }
  }

  const showStroke = feature.featureType !== 'point';
  const customColorValue = normalizeHexColor(colorText) ?? feature.properties.color;

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
        <Stack direction="row" spacing={0.5}>
          {showStroke && (
            <Tooltip title={isEditingVertices ? 'Stop editing vertices' : 'Edit vertices'}>
              <IconButton
                size="small"
                color={isEditingVertices ? 'primary' : 'default'}
                onClick={onToggleEditVertices}
                aria-label="Toggle vertex editing"
              >
                <PolylineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose} aria-label="Close feature details">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <TextField
          label="Title"
          size="small"
          fullWidth
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
        />

        {coordinates && <MeasurementStat label="Coordinates" value={coordinates} />}

        {measurements && (
          <Box>
            <Stack direction="row" spacing={2} mb={1}>
              <UnitSelect
                label="Distance unit"
                value={distanceUnit}
                options={DISTANCE_UNIT_OPTIONS}
                onChange={setDistanceUnit}
              />
              {measurements.kind === 'polygon' && (
                <UnitSelect label="Area unit" value={areaUnit} options={AREA_UNIT_OPTIONS} onChange={setAreaUnit} />
              )}
            </Stack>
            <Stack direction="row" spacing={2}>
              {measurements.kind === 'line' ? (
                <MeasurementStat label="Length" value={formatDistance(measurements.length, distanceUnit)} />
              ) : (
                <>
                  <MeasurementStat label="Perimeter" value={formatDistance(measurements.perimeter, distanceUnit)} />
                  <MeasurementStat label="Area" value={formatArea(measurements.area, areaUnit)} />
                </>
              )}
            </Stack>
          </Box>
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
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {FEATURE_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => selectColor(color)}
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
            <Tooltip title="Custom color">
              <Box
                component="input"
                type="color"
                value={customColorValue}
                onChange={(e) => selectColor(e.target.value)}
                sx={{
                  width: 32,
                  height: 32,
                  p: 0,
                  border: 'none',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  '&::-webkit-color-swatch-wrapper': { p: 0 },
                  '&::-webkit-color-swatch': { border: '2px solid black', borderRadius: '50%' },
                  '&::-moz-color-swatch': { border: '2px solid black', borderRadius: '50%' },
                }}
              />
            </Tooltip>
            <TextField
              size="small"
              variant="standard"
              value={colorText}
              onChange={(e) => setColorText(e.target.value)}
              onBlur={commitColorText}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitColorText();
              }}
              sx={{ width: 84, mt: 1 }}
              inputProps={{ 'aria-label': 'Custom color hex value' }}
            />
          </Stack>
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
                onChangeCommitted={(_e, value) =>
                  updateMutation.mutate({ properties: { strokeWidth: value as number } })
                }
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Line style
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={feature.properties.lineStyle ?? 'solid'}
                onChange={(_e, next: LineStyle | null) => {
                  if (next) updateMutation.mutate({ properties: { lineStyle: next } });
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
          Delete Feature
        </Button>
      </Stack>
    </Paper>
  );
}
