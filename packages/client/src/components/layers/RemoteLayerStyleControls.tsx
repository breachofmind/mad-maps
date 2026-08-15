import { useMemo, type ReactNode } from 'react';
import type mapboxgl from 'mapbox-gl';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { LayerColorStop, LayerDTO, LayerIconRule, LayerStyleConfig } from '@mad-maps/shared';
import { useEditorStore } from '../../lib/state/editorStore';
import { usePmtilesSourceFeatures } from '../../lib/map/usePmtilesSourceFeatures';
import { collectDistinctValues, collectPropertyStats, numericRange, pmtilesPropertyStats } from '../../lib/layers/propertyStats';
import { ColorSwatchInput } from '../common/ColorSwatchInput';
import { PinPicker } from '../mapFeatures/PinPicker';

const EMPTY_STYLE_CONFIG: LayerStyleConfig = {
  labelProperty: null,
  colorProperty: null,
  colorStops: [],
  iconProperty: null,
  iconRules: [],
  defaultIconUrl: null,
};
const DEFAULT_LOW_COLOR = '#1976d2';
const DEFAULT_HIGH_COLOR = '#d32f2f';

// Matches BaseLayerPanel's dropdown — dark fill, no visible border — so
// every select in the sidebar looks like the same family of dark inputs.
const DARK_SELECT_SX = {
  bgcolor: '#1a1c1b',
  borderRadius: 1,
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
};

// Shared by InlineFieldRow and GradientStopRow so "Label"/"Colorize" line up
// with "High"/"Low" in the column below them.
const PROPERTY_LABEL_WIDTH = 60;

// Caption to the left, control filling the rest of the row — matches
// Figma's Label/Colorize rows (a stacked caption-above-control layout is
// only used for Icon by Value, which Figma shows as its own heading).
function InlineFieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="caption" color="text.secondary" sx={{ width: PROPERTY_LABEL_WIDTH, flexShrink: 0 }}>
        {label}
      </Typography>
      {children}
    </Stack>
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
      <Typography variant="body2" color="text.secondary" sx={{ width: PROPERTY_LABEL_WIDTH, flexShrink: 0 }}>
        {label}
      </Typography>
      <TextField
        size="small"
        type="number"
        value={stop.value}
        onChange={(e) => onChange({ ...stop, value: Number(e.target.value) })}
        sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
        slotProps={{ htmlInput: { 'aria-label': `${label} gradient value` } }}
      />
      <ColorSwatchInput
        variant="chip"
        width={65}
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
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography
        variant="body2"
        sx={{ width: 64, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {rule.value}
      </Typography>
      <PinPicker value={rule.iconUrl} onChange={onChange} failed={failed} />
      <IconButton size="small" onClick={onRemove} aria-label={`Remove icon for ${rule.value}`}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

interface RemoteLayerStyleControlsProps {
  layer: LayerDTO;
  map: mapboxgl.Map | null;
  isRefreshing: boolean;
  externalData?: GeoJSON.FeatureCollection;
  onStyleConfigChange: (styleConfig: LayerStyleConfig) => void;
  onRefresh: () => void;
}

// Style controls (label, colorize-by-value, icon-by-value, data source) for
// a geojson-url or pmtiles-url layer — the "local" layers this panel also
// renders don't have a remote source or a styleConfig to edit, so this whole
// block only ever mounts for LayerPropertiesPanel's isRemote case. The
// layer's flat color lives in LayerPropertiesPanel's shared color chip
// (same control local layers use), not here.
export function RemoteLayerStyleControls({
  layer,
  map,
  isRefreshing,
  externalData,
  onStyleConfigChange,
  onRefresh,
}: RemoteLayerStyleControlsProps) {
  const isPmtiles = layer.sourceType === 'pmtiles-url';
  // Merged rather than a plain `?? EMPTY_STYLE_CONFIG` fallback so a
  // styleConfig saved before iconProperty/iconRules existed still has both
  // fields defined.
  const styleConfig: LayerStyleConfig = { ...EMPTY_STYLE_CONFIG, ...(layer.styleConfig ?? {}) };
  const failedIconUrls = useEditorStore((s) => s.failedIconUrls);

  // pmtiles-url layers have no server-fetched FeatureCollection (see
  // RemoteLayer.tsx) — property names come from the archive metadata
  // captured at add-time (authoritative, via pmtilesPropertyStats), while
  // numeric ranges/distinct values fall back to sampling whichever tiles
  // are currently loaded (best-effort, not the full dataset).
  const pmtilesSampleData = usePmtilesSourceFeatures(map, layer);
  const effectiveData = isPmtiles ? pmtilesSampleData : externalData;
  const geojsonStats = useMemo(() => collectPropertyStats(externalData), [externalData]);
  const stats = isPmtiles ? pmtilesPropertyStats(layer) : geojsonStats;

  function handleLabelPropertyChange(e: SelectChangeEvent) {
    onStyleConfigChange({ ...styleConfig, labelProperty: e.target.value || null });
  }

  function handleColorPropertyChange(e: SelectChangeEvent) {
    const colorProperty = e.target.value || null;
    if (!colorProperty) {
      onStyleConfigChange({ ...styleConfig, colorProperty: null });
      return;
    }
    const range = numericRange(effectiveData, colorProperty);
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
    () => (styleConfig.iconProperty ? collectDistinctValues(effectiveData, styleConfig.iconProperty) : []),
    [effectiveData, styleConfig.iconProperty],
  );
  const mappedIconValues = new Set(styleConfig.iconRules.map((rule) => rule.value));
  const unmappedIconValues = distinctIconValues.filter((value) => !mappedIconValues.has(value));

  return (
    <>
      <InlineFieldRow label="Label">
        <FormControl size="small" fullWidth>
          <Select
            value={styleConfig.labelProperty ?? ''}
            displayEmpty
            onChange={handleLabelPropertyChange}
            disabled={stats.all.length === 0}
            sx={DARK_SELECT_SX}
          >
            <MenuItem value="">None</MenuItem>
            {stats.all.map((key) => (
              <MenuItem key={key} value={key}>
                {key}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </InlineFieldRow>

      <Box>
        <InlineFieldRow label="Colorize">
          <FormControl size="small" fullWidth>
            <Select
              value={styleConfig.colorProperty ?? ''}
              displayEmpty
              onChange={handleColorPropertyChange}
              disabled={stats.numeric.length === 0}
              sx={DARK_SELECT_SX}
            >
              <MenuItem value="">Flat color</MenuItem>
              {stats.numeric.map((key) => (
                <MenuItem key={key} value={key}>
                  {key}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </InlineFieldRow>
        {styleConfig.colorProperty && lowStop && highStop && (
          <Stack spacing={1} mt={1}>
            <GradientStopRow label="High" stop={highStop} onChange={(stop) => updateColorStop(1, stop)} />
            <GradientStopRow label="Low" stop={lowStop} onChange={(stop) => updateColorStop(0, stop)} />
            {gradientRangeInvalid && (
              <Typography variant="caption" color="error">
                Low value must be less than high value — using the flat color until fixed.
              </Typography>
            )}
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          Icon by Value
        </Typography>
        <FormControl size="small" fullWidth>
          <Select
            value={styleConfig.iconProperty ?? ''}
            displayEmpty
            onChange={handleIconPropertyChange}
            disabled={stats.all.length === 0}
            sx={DARK_SELECT_SX}
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
                <Select value="" displayEmpty onChange={(e) => addIconRule(e.target.value)} sx={DARK_SELECT_SX}>
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
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          Data source
        </Typography>
        {layer.sourceUrl && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, wordBreak: 'break-all' }}>
            {layer.sourceUrl}
          </Typography>
        )}
        {layer.sourceType === 'geojson-url' && (
          <Button
            size="small"
            variant="outlined"
            disabled={isRefreshing}
            startIcon={isRefreshing ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
            onClick={onRefresh}
          >
            Refresh data
          </Button>
        )}
      </Box>
    </>
  );
}
