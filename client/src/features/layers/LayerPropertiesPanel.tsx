import { useEffect, useMemo, useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { LayerColorStop, LayerDTO, LayerIconRule, LayerStyleConfig } from '@mapinski/shared';
import { useEditorStore } from '../../state/editorStore';
import { previewIconImage } from '../map/externalIconImages';
import { collectDistinctValues, collectPropertyStats, numericRange } from './propertyStats';

const EMPTY_STYLE_CONFIG: LayerStyleConfig = {
  labelProperty: null,
  colorProperty: null,
  colorStops: [],
  iconProperty: null,
  iconRules: [],
};
const DEFAULT_LOW_COLOR = '#1976d2';
const DEFAULT_HIGH_COLOR = '#d32f2f';

const COLOR_SWATCH_SX = {
  width: 32,
  height: 32,
  p: 0,
  border: 'none',
  borderRadius: '50%',
  overflow: 'hidden',
  cursor: 'pointer',
  '&::-webkit-color-swatch-wrapper': { p: 0 },
  '&::-webkit-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
  '&::-moz-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
};

function ColorSwatchInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
}) {
  return (
    <Box
      component="input"
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      sx={COLOR_SWATCH_SX}
    />
  );
}

function GradientStopRow({
  label,
  stop,
  onChange,
}: {
  label: string;
  stop: LayerColorStop;
  onChange: (stop: LayerColorStop) => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" color="text.secondary" sx={{ width: 36, flexShrink: 0 }}>
        {label}
      </Typography>
      <TextField
        size="small"
        type="number"
        value={stop.value}
        onChange={(e) => onChange({ ...stop, value: Number(e.target.value) })}
        sx={{ width: 100 }}
        slotProps={{ htmlInput: { 'aria-label': `${label} gradient value` } }}
      />
      <ColorSwatchInput
        value={stop.color}
        onChange={(color) => onChange({ ...stop, color })}
        ariaLabel={`${label} gradient color`}
      />
    </Stack>
  );
}

function IconRuleRow({
  rule,
  failed,
  onChange,
  onRemove,
}: {
  rule: LayerIconRule;
  failed: boolean;
  onChange: (iconUrl: string) => void;
  onRemove: () => void;
}) {
  // Local draft state so typing a URL doesn't PATCH the server on every
  // keystroke — committed on blur/Enter, matching LayerPanel's rename-field
  // pattern.
  const [draftUrl, setDraftUrl] = useState(rule.iconUrl);
  useEffect(() => setDraftUrl(rule.iconUrl), [rule.iconUrl]);

  // Preview is rendered from the *same* cached raster externalIconImages.ts
  // produces for the map (as a data: url), rather than a plain
  // `<img src={url}>` — two independent DOM image loads of the same
  // cross-origin url can otherwise race/conflict in the browser's image
  // cache and spuriously fail CORS on one of them. Keyed off the committed
  // rule.iconUrl (not the live draft) so it doesn't fire a fetch per
  // keystroke while typing.
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!rule.iconUrl) {
      setPreviewSrc(null);
      return;
    }
    previewIconImage(rule.iconUrl).then((src) => {
      if (!cancelled) setPreviewSrc(src);
    });
    return () => {
      cancelled = true;
    };
  }, [rule.iconUrl]);

  function commit() {
    const trimmed = draftUrl.trim();
    if (trimmed !== rule.iconUrl) onChange(trimmed);
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box
        component="img"
        src={previewSrc ?? undefined}
        alt=""
        sx={{
          width: 24,
          height: 24,
          objectFit: 'contain',
          flexShrink: 0,
          visibility: previewSrc ? 'visible' : 'hidden',
        }}
      />
      <Typography
        variant="body2"
        sx={{ width: 64, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {rule.value}
      </Typography>
      <TextField
        size="small"
        placeholder="Icon image URL"
        value={draftUrl}
        onChange={(e) => setDraftUrl(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        error={failed}
        helperText={failed ? "Couldn't load this image" : undefined}
        fullWidth
      />
      <IconButton size="small" onClick={onRemove} aria-label={`Remove icon for ${rule.value}`}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

interface LayerPropertiesPanelProps {
  layer: LayerDTO;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isRefreshing: boolean;
  externalData?: GeoJSON.FeatureCollection;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onColorChange: (color: string) => void;
  onStyleConfigChange: (styleConfig: LayerStyleConfig) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function LayerPropertiesPanel({
  layer,
  canMoveUp,
  canMoveDown,
  isRefreshing,
  externalData,
  onMoveUp,
  onMoveDown,
  onColorChange,
  onStyleConfigChange,
  onRefresh,
  onDelete,
  onClose,
}: LayerPropertiesPanelProps) {
  const isRemote = layer.sourceType === 'geojson-url';
  // Merged rather than a plain `?? EMPTY_STYLE_CONFIG` fallback so a
  // styleConfig saved before iconProperty/iconRules existed still has both
  // fields defined.
  const styleConfig: LayerStyleConfig = { ...EMPTY_STYLE_CONFIG, ...(layer.styleConfig ?? {}) };
  const stats = useMemo(() => collectPropertyStats(externalData), [externalData]);
  const failedIconUrls = useEditorStore((s) => s.failedIconUrls);

  function handleLabelPropertyChange(e: SelectChangeEvent) {
    onStyleConfigChange({ ...styleConfig, labelProperty: e.target.value || null });
  }

  function handleColorPropertyChange(e: SelectChangeEvent) {
    const colorProperty = e.target.value || null;
    if (!colorProperty) {
      onStyleConfigChange({ ...styleConfig, colorProperty: null });
      return;
    }
    const range = numericRange(externalData, colorProperty);
    const colorStops: LayerColorStop[] = [
      { value: range?.min ?? 0, color: DEFAULT_LOW_COLOR },
      { value: range?.max ?? 1, color: DEFAULT_HIGH_COLOR },
    ];
    onStyleConfigChange({ ...styleConfig, colorProperty, colorStops });
  }

  function updateColorStop(index: 0 | 1, stop: LayerColorStop) {
    const colorStops: LayerColorStop[] = [...styleConfig.colorStops];
    colorStops[index] = stop;
    onStyleConfigChange({ ...styleConfig, colorStops });
  }

  const [lowStop, highStop] = styleConfig.colorStops;
  const gradientRangeInvalid = Boolean(lowStop && highStop && lowStop.value >= highStop.value);

  function handleIconPropertyChange(e: SelectChangeEvent) {
    const iconProperty = e.target.value || null;
    // Rules are keyed to a specific property's value space, so switching to
    // a different property starts fresh rather than carrying over mappings
    // that would just never match anything.
    const iconRules = iconProperty === styleConfig.iconProperty ? styleConfig.iconRules : [];
    onStyleConfigChange({ ...styleConfig, iconProperty, iconRules });
  }

  function addIconRule(value: string) {
    if (!value) return;
    onStyleConfigChange({ ...styleConfig, iconRules: [...styleConfig.iconRules, { value, iconUrl: '' }] });
  }

  function updateIconRule(index: number, iconUrl: string) {
    const iconRules = [...styleConfig.iconRules];
    iconRules[index] = { ...iconRules[index], iconUrl };
    onStyleConfigChange({ ...styleConfig, iconRules });
  }

  function removeIconRule(index: number) {
    onStyleConfigChange({ ...styleConfig, iconRules: styleConfig.iconRules.filter((_, i) => i !== index) });
  }

  const distinctIconValues = useMemo(
    () => (styleConfig.iconProperty ? collectDistinctValues(externalData, styleConfig.iconProperty) : []),
    [externalData, styleConfig.iconProperty],
  );
  const mappedIconValues = new Set(styleConfig.iconRules.map((rule) => rule.value));
  const unmappedIconValues = distinctIconValues.filter((value) => !mappedIconValues.has(value));

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
        <Typography variant="subtitle1" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {layer.name}
        </Typography>
        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} aria-label="Close layer details">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2}>
        {isRemote && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Color
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <ColorSwatchInput value={layer.color} onChange={onColorChange} ariaLabel={`Change ${layer.name} color`} />
              <Typography variant="body2" color="text.secondary">
                {layer.color}
              </Typography>
            </Stack>
          </Box>
        )}

        {isRemote && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Label
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                value={styleConfig.labelProperty ?? ''}
                displayEmpty
                onChange={handleLabelPropertyChange}
                disabled={stats.all.length === 0}
              >
                <MenuItem value="">None</MenuItem>
                {stats.all.map((key) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              Shows this property as text next to each feature on the map.
            </Typography>
          </Box>
        )}

        {isRemote && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Colorize by value
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                value={styleConfig.colorProperty ?? ''}
                displayEmpty
                onChange={handleColorPropertyChange}
                disabled={stats.numeric.length === 0}
              >
                <MenuItem value="">Flat color</MenuItem>
                {stats.numeric.map((key) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {styleConfig.colorProperty && lowStop && highStop && (
              <Stack spacing={1} mt={1}>
                <GradientStopRow label="Low" stop={lowStop} onChange={(stop) => updateColorStop(0, stop)} />
                <GradientStopRow label="High" stop={highStop} onChange={(stop) => updateColorStop(1, stop)} />
                {gradientRangeInvalid && (
                  <Typography variant="caption" color="error">
                    Low value must be less than high value — using the flat color until fixed.
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        )}

        {isRemote && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Icon by value
            </Typography>
            <FormControl size="small" fullWidth>
              <Select
                value={styleConfig.iconProperty ?? ''}
                displayEmpty
                onChange={handleIconPropertyChange}
                disabled={stats.all.length === 0}
              >
                <MenuItem value="">Default marker</MenuItem>
                {stats.all.map((key) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {styleConfig.iconProperty && (
              <Stack spacing={1} mt={1}>
                {styleConfig.iconRules.map((rule, index) => (
                  <IconRuleRow
                    key={rule.value}
                    rule={rule}
                    failed={failedIconUrls.has(rule.iconUrl)}
                    onChange={(iconUrl) => updateIconRule(index, iconUrl)}
                    onRemove={() => removeIconRule(index)}
                  />
                ))}
                {unmappedIconValues.length > 0 && (
                  <FormControl size="small" fullWidth>
                    <Select value="" displayEmpty onChange={(e) => addIconRule(e.target.value)}>
                      <MenuItem value="" disabled>
                        Add a value…
                      </MenuItem>
                      {unmappedIconValues.map((value) => (
                        <MenuItem key={value} value={value}>
                          {value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <Typography variant="caption" color="text.secondary">
                  Values left without an icon keep the default marker. Images must be publicly reachable and allow
                  cross-origin use (CORS) to display on the map.
                </Typography>
              </Stack>
            )}
          </Box>
        )}

        {isRemote && (
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              Data source
            </Typography>
            {layer.sourceUrl && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, wordBreak: 'break-all' }}
              >
                {layer.sourceUrl}
              </Typography>
            )}
            <Button
              size="small"
              variant="outlined"
              disabled={isRefreshing}
              startIcon={isRefreshing ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
              onClick={onRefresh}
            >
              Refresh data
            </Button>
          </Box>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
            Order
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              disabled={!canMoveUp}
              startIcon={<ArrowUpwardIcon fontSize="small" />}
              onClick={onMoveUp}
            >
              Move up
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!canMoveDown}
              startIcon={<ArrowDownwardIcon fontSize="small" />}
              onClick={onMoveDown}
            >
              Move down
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Button size="small" color="error" startIcon={<DeleteIcon fontSize="small" />} onClick={onDelete}>
          Delete Layer
        </Button>
      </Stack>
    </Paper>
  );
}
