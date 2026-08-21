import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DeleteIcon from '@mui/icons-material/Delete';
import PolylineIcon from '@mui/icons-material/Polyline';
import type { FeatureType, LineStyle, MapFeatureDTO } from '@mad-maps/shared';
import { deleteFeature, featuresQueryKey, updateFeature, type UpdateFeatureInput } from '../../lib/mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { RichTextEditor } from './RichTextEditor';
import { IconPicker } from './IconPicker';
import { PluginDataSection } from './PluginDataSection';
import { FeatureMetadataEditor } from './FeatureMetadataEditor';
import { SANITIZE_CONFIG } from '../../lib/mapFeatures/sanitizeConfig';
import { MeasurementStat, PropertyReadOnlyRow, UnitSelect } from './featurePropertiesShared';
import { PanelHeader, PanelBody } from '../common/Panel';
import { ColorSwatchInput } from '../common/ColorSwatchInput';
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
  text: 'Text',
};

const DEFAULT_STROKE_WIDTH = 3;
const DEFAULT_TEXT_FONT_SIZE = 16;

const LINE_STYLE_OPTIONS: { value: LineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

interface FeaturePropertiesPanelProps {
  feature: MapFeatureDTO;
  layerId: string;
  pluginEndpointUrl: string | null;
  pluginId: string | null;
  onClose: () => void;
  isEditingVertices: boolean;
  onToggleEditVertices: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function FeaturePropertiesPanel({
  feature,
  layerId,
  pluginEndpointUrl,
  pluginId,
  onClose,
  isEditingVertices,
  onToggleEditVertices,
  collapsed,
  onToggleCollapse,
}: FeaturePropertiesPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(feature.properties.title);
  const [description, setDescription] = useState(feature.properties.descriptionHtml);
  const [strokeWidth, setStrokeWidth] = useState(feature.properties.strokeWidth ?? DEFAULT_STROKE_WIDTH);
  const [fontSize, setFontSize] = useState(feature.properties.fontSize ?? DEFAULT_TEXT_FONT_SIZE);
  const titleInputRef = useRef<HTMLInputElement>(null);
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

  // Jump straight into typing after placing a new text feature — a
  // freshly-placed one always has an empty title, so this never refocuses
  // an already-titled feature on reselection.
  useEffect(() => {
    if (feature.featureType === 'text' && feature.properties.title === '') {
      titleInputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feature.id]);

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

  const showStroke = feature.featureType === 'line' || feature.featureType === 'polygon';
  const showFontSize = feature.featureType === 'text';

  const headerActions = showStroke && (
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
  );

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        flex: collapsed ? '0 0 auto' : 1,
        minHeight: 0,
      }}
    >
      <PanelHeader
        title={`${FEATURE_TYPE_LABELS[feature.featureType]} Properties`}
        actions={headerActions}
        onClose={onClose}
        closeLabel="Close feature details"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        collapseLabel="properties"
      />

      {!collapsed && <PanelBody>
        <Stack spacing={2}>
          {coordinates && <PropertyReadOnlyRow label="Coordinates" value={coordinates} />}

          {measurements && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                <UnitSelect
                  label="Distance unit"
                  value={distanceUnit}
                  options={DISTANCE_UNIT_OPTIONS}
                  onChange={setDistanceUnit}
                />
                <MeasurementStat
                  label={measurements.kind === 'line' ? 'Length' : 'Perimeter'}
                  value={formatDistance(
                    measurements.kind === 'line' ? measurements.length : measurements.perimeter,
                    distanceUnit,
                  )}
                  align="right"
                />
              </Stack>
              {measurements.kind === 'polygon' && (
                <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
                  <UnitSelect label="Area unit" value={areaUnit} options={AREA_UNIT_OPTIONS} onChange={setAreaUnit} />
                  <MeasurementStat label="Area" value={formatArea(measurements.area, areaUnit)} align="right" />
                </Stack>
              )}
            </Stack>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            {feature.featureType !== 'text' && (
              <IconPicker
                iconOnly
                value={feature.properties.icon}
                color={feature.properties.color}
                onChange={(icon) => updateMutation.mutate({ properties: { icon } })}
              />
            )}
            <TextField
              size="small"
              fullWidth
              placeholder={feature.featureType === 'text' ? 'Text' : 'Untitled'}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              inputRef={titleInputRef}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
            />
          </Stack>

          <ColorSwatchInput
            variant="chip"
            value={feature.properties.color}
            onChange={(color) => updateMutation.mutate({ properties: { color } })}
            ariaLabel={`Change ${feature.properties.title || 'feature'} color`}
          />

          <RichTextEditor key={feature.id} value={description} onChange={handleDescriptionChange} />

          {showFontSize && (
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Font size
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {fontSize}px
                </Typography>
              </Stack>
              <Slider
                size="small"
                min={8}
                max={64}
                step={1}
                value={fontSize}
                onChange={(_e, value) => setFontSize(value as number)}
                onChangeCommitted={(_e, value) => updateMutation.mutate({ properties: { fontSize: value as number } })}
              />
            </Box>
          )}

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

          <FeatureMetadataEditor
            key={`metadata-${feature.id}`}
            metadata={feature.properties.metadata ?? {}}
            onCommit={(metadata) => updateMutation.mutate({ properties: { metadata } })}
          />

          {(pluginEndpointUrl || pluginId) && <PluginDataSection layerId={layerId} featureId={feature.id} />}

          <Divider />

          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={() => deleteMutation.mutate()}
            sx={{ alignSelf: 'flex-start' }}
          >
            Delete
          </Button>
        </Stack>
      </PanelBody>}
    </Box>
  );
}
