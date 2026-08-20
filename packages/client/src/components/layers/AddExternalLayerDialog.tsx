import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { isXyzTileUrlTemplate } from '@mad-maps/shared';
import { EXTERNAL_DATASETS } from '../../lib/layers/externalDatasets';
import { createLayer, deleteLayer, fetchExternalLayerData, inspectPmtiles, layersQueryKey } from '../../lib/layers/api';

const CUSTOM_GEOJSON_OPTION_ID = 'custom-geojson';
const CUSTOM_RASTER_OPTION_ID = 'custom-raster';
const CUSTOM_PMTILES_OPTION_ID = 'custom-pmtiles';
// Debounces the PMTiles inspect request so it fires once typing pauses
// rather than on every keystroke — the request itself is cheap (a couple of
// small range reads), but there's no reason to spam it mid-paste/mid-type.
const PMTILES_INSPECT_DEBOUNCE_MS = 400;

interface AddExternalLayerDialogProps {
  open: boolean;
  onClose: () => void;
  mapId: string;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function AddExternalLayerDialog({ open, onClose, mapId }: AddExternalLayerDialogProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>(EXTERNAL_DATASETS[0]?.id ?? CUSTOM_GEOJSON_OPTION_ID);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [pmtilesName, setPmtilesName] = useState('');
  const [pmtilesUrl, setPmtilesUrl] = useState('');
  const [pmtilesSourceLayer, setPmtilesSourceLayer] = useState('');
  const [debouncedPmtilesUrl, setDebouncedPmtilesUrl] = useState('');

  const isCustomGeojson = selectedId === CUSTOM_GEOJSON_OPTION_ID;
  const isCustomRaster = selectedId === CUSTOM_RASTER_OPTION_ID;
  const isPmtiles = selectedId === CUSTOM_PMTILES_OPTION_ID;
  const dataset = EXTERNAL_DATASETS.find((d) => d.id === selectedId);
  const isRaster = isCustomRaster || dataset?.format === 'raster';
  const name = isCustomGeojson || isCustomRaster ? customName.trim() : (dataset?.label ?? '');
  const url = isCustomGeojson || isCustomRaster ? customUrl.trim() : (dataset?.url ?? '');
  const canSubmitGeojson = name.length > 0 && isValidHttpUrl(url);
  const canSubmitRaster = name.length > 0 && isXyzTileUrlTemplate(url);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedPmtilesUrl(pmtilesUrl.trim()), PMTILES_INSPECT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [pmtilesUrl]);

  const inspectQuery = useQuery({
    queryKey: ['pmtiles-inspect', debouncedPmtilesUrl],
    queryFn: () => inspectPmtiles(debouncedPmtilesUrl),
    enabled: isPmtiles && isValidHttpUrl(debouncedPmtilesUrl),
    staleTime: Infinity,
    retry: false,
  });

  // Auto-selects the only source-layer so the common case (a single-layer
  // archive) needs no extra click; a multi-layer archive still requires an
  // explicit pick (canSubmitPmtiles below blocks submit until one is made).
  useEffect(() => {
    const layers = inspectQuery.data?.layers;
    setPmtilesSourceLayer(layers?.length === 1 ? layers[0].id : '');
  }, [inspectQuery.data]);

  const canSubmitPmtiles =
    pmtilesName.trim().length > 0 &&
    Boolean(inspectQuery.data) &&
    (inspectQuery.data!.layers.length === 1 || pmtilesSourceLayer.length > 0);

  const addMutation = useMutation({
    // Fetches the URL through the server right after creating the layer, as
    // a validation step — if the source is unreachable or isn't valid
    // GeoJSON, the half-created layer is rolled back rather than leaving a
    // layer behind that will never render anything.
    mutationFn: async () => {
      const layer = await createLayer(mapId, name, url);
      try {
        await fetchExternalLayerData(layer.id);
      } catch (err) {
        await deleteLayer(layer.id);
        throw err;
      }
      return layer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: layersQueryKey(mapId) });
      handleClose();
    },
  });

  const addRasterMutation = useMutation({
    // Unlike the GeoJSON flow above, there's nothing to cheaply fetch/parse
    // server-side to validate a {z}/{x}/{y} tile template ahead of time —
    // Mapbox will simply fail to render tiles if it's wrong, the same trust
    // level the basemap "Add Style" raster flow already gives this shape of
    // URL (see rasterTileStyle.ts).
    mutationFn: () => createLayer(mapId, name, url, { sourceFormat: 'raster' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: layersQueryKey(mapId) });
      handleClose();
    },
  });

  const addPmtilesMutation = useMutation({
    // Unlike the GeoJSON flow above, validation (inspectQuery) already ran
    // before this point, so there's no create-then-rollback dance — the
    // layer is only ever created once we know the URL is a readable
    // vector PMTiles archive with the chosen source-layer.
    mutationFn: () =>
      createLayer(mapId, pmtilesName.trim(), pmtilesUrl.trim(), {
        sourceFormat: 'pmtiles',
        sourceLayer: pmtilesSourceLayer,
        pmtilesMetadata: inspectQuery.data!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: layersQueryKey(mapId) });
      handleClose();
    },
  });

  function handleClose() {
    addMutation.reset();
    addRasterMutation.reset();
    addPmtilesMutation.reset();
    setCustomName('');
    setCustomUrl('');
    setPmtilesName('');
    setPmtilesUrl('');
    setPmtilesSourceLayer('');
    setDebouncedPmtilesUrl('');
    setSelectedId(EXTERNAL_DATASETS[0]?.id ?? CUSTOM_GEOJSON_OPTION_ID);
    onClose();
  }

  function handleSubmit() {
    if (isPmtiles) addPmtilesMutation.mutate();
    else if (isRaster) addRasterMutation.mutate();
    else addMutation.mutate();
  }

  const canSubmit = isPmtiles ? canSubmitPmtiles : isRaster ? canSubmitRaster : canSubmitGeojson;
  const isPending = isPmtiles ? addPmtilesMutation.isPending : isRaster ? addRasterMutation.isPending : addMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Data Layer</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Overlay a public GeoJSON, raster tile, or PMTiles dataset on this map. It renders live from the source and
          can be toggled or removed like any other layer.
        </Typography>
        <RadioGroup value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {EXTERNAL_DATASETS.map((ds) => (
            <FormControlLabel
              key={ds.id}
              value={ds.id}
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2">{ds.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {ds.description}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', mb: 1 }}
            />
          ))}
          <FormControlLabel value={CUSTOM_GEOJSON_OPTION_ID} control={<Radio size="small" />} label="Custom GeoJSON URL" />
          <FormControlLabel value={CUSTOM_RASTER_OPTION_ID} control={<Radio size="small" />} label="Custom raster tile URL" />
          <FormControlLabel value={CUSTOM_PMTILES_OPTION_ID} control={<Radio size="small" />} label="Custom PMTiles URL" />
        </RadioGroup>

        {(isCustomGeojson || isCustomRaster) && (
          <Box display="flex" flexDirection="column" gap={1.5} mt={1} pl={4}>
            <TextField
              size="small"
              label="Layer name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              fullWidth
            />
            {isCustomRaster ? (
              <TextField
                size="small"
                label="Raster tile URL"
                placeholder="https://example.com/tiles/{z}/{x}/{y}.png"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                error={customUrl.trim().length > 0 && !isXyzTileUrlTemplate(customUrl.trim())}
                helperText="Must contain {z}, {x}, and {y}"
                fullWidth
              />
            ) : (
              <TextField
                size="small"
                label="GeoJSON URL"
                placeholder="https://example.com/data.geojson"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                error={customUrl.trim().length > 0 && !isValidHttpUrl(customUrl.trim())}
                fullWidth
              />
            )}
          </Box>
        )}

        {isPmtiles && (
          <Box display="flex" flexDirection="column" gap={1.5} mt={1} pl={4}>
            <TextField
              size="small"
              label="Layer name"
              value={pmtilesName}
              onChange={(e) => setPmtilesName(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="PMTiles URL"
              placeholder="https://example.com/data.pmtiles"
              value={pmtilesUrl}
              onChange={(e) => setPmtilesUrl(e.target.value)}
              error={pmtilesUrl.trim().length > 0 && !isValidHttpUrl(pmtilesUrl.trim())}
              helperText={inspectQuery.isFetching ? 'Reading archive…' : undefined}
              fullWidth
            />
            {inspectQuery.isError && (
              <Alert severity="error">
                Couldn't read that as a PMTiles archive. Double-check the URL and that it's a vector (MVT) tileset.
              </Alert>
            )}
            {inspectQuery.data && inspectQuery.data.layers.length > 1 && (
              <FormControl size="small" fullWidth>
                <InputLabel id="pmtiles-source-layer-label">Source layer</InputLabel>
                <Select
                  labelId="pmtiles-source-layer-label"
                  label="Source layer"
                  value={pmtilesSourceLayer}
                  onChange={(e) => setPmtilesSourceLayer(e.target.value)}
                >
                  {inspectQuery.data.layers.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        )}

        {(isPmtiles ? addPmtilesMutation.isError : isRaster ? addRasterMutation.isError : addMutation.isError) && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {isPmtiles
              ? "Couldn't create that layer. Please try again."
              : isRaster
                ? "Couldn't create that layer. Please try again."
                : "Couldn't load that data source. Double-check the URL and that it returns a valid GeoJSON FeatureCollection."}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSubmit || isPending}
          onClick={handleSubmit}
          startIcon={isPending ? <CircularProgress size={16} /> : undefined}
        >
          Add Layer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
