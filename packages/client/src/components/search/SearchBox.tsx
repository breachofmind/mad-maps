import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import type { LayerDTO, PlaceResultDTO } from '@mad-maps/shared';
import type mapboxgl from 'mapbox-gl';
import { mapboxgl as mapboxglRuntime } from '../../lib/map/mapbox';
import { searchPlaces } from '../../lib/search/api';
import { createFeature, featuresQueryKey } from '../../lib/mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';
import { SANITIZE_CONFIG } from '../../lib/mapFeatures/sanitizeConfig';
import { useEditorStore } from '../../lib/state/editorStore';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildDescriptionHtml(place: PlaceResultDTO): string {
  const lines: string[] = [];
  if (place.formattedAddress) {
    lines.push(`<p>${escapeHtml(place.formattedAddress)}</p>`);
  }
  if (place.rating != null) {
    const count = place.userRatingCount != null ? ` (${place.userRatingCount.toLocaleString()} reviews)` : '';
    lines.push(`<p>${escapeHtml(`${place.rating.toFixed(1)}★${count}`)}</p>`);
  }
  if (place.googleMapsUri) {
    const href = escapeHtml(place.googleMapsUri);
    lines.push(`<p><a href="${href}" target="_blank" rel="noopener noreferrer">View on Google Maps</a></p>`);
  }
  return lines.join('');
}

interface SearchBoxProps {
  map: mapboxgl.Map | null;
  activeLayer: LayerDTO | null;
}

export function SearchBox({ map, activeLayer }: SearchBoxProps) {
  const activeLayerId = activeLayer?.id ?? null;
  const canAddFeatures = activeLayer?.sourceType === 'local';
  const queryClient = useQueryClient();
  const setSelection = useEditorStore((s) => s.setSelection);
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceResultDTO | null>(null);

  const applyDebouncedQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, 350);

  const { data: options, isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchPlaces(debouncedQuery),
    enabled: debouncedQuery.trim().length > 1,
  });

  const addPinMutation = useMutation({
    mutationFn: (place: PlaceResultDTO) =>
      createFeature(activeLayerId!, {
        geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
        properties: {
          title: place.name,
          descriptionHtml: DOMPurify.sanitize(buildDescriptionHtml(place), SANITIZE_CONFIG),
          color: activeLayer!.color,
          icon: activeLayer!.defaultIcon,
        },
      }),
    onSuccess: async (result) => {
      if (activeLayerId) {
        await queryClient.invalidateQueries({ queryKey: featuresQueryKey(activeLayerId) });
        setSelection({ type: 'feature', featureIds: [result.id] });
      }
      setSelectedPlace(null);
    },
  });

  // Preview marker + popup for the selected-but-not-yet-added place. Dismissed
  // by clicking elsewhere on the map, starting a new search, or successfully
  // adding the pin (all of which clear `selectedPlace`).
  useEffect(() => {
    if (!map || !selectedPlace) return;

    const place = selectedPlace;
    const container = document.createElement('div');
    const root: Root = createRoot(container);
    const sanitizedDescription = DOMPurify.sanitize(buildDescriptionHtml(place), SANITIZE_CONFIG);

    root.render(
      <Stack spacing={0.5} sx={{ maxWidth: 240 }}>
        <Typography variant="subtitle2">{place.name}</Typography>
        {sanitizedDescription && (
          <Box
            sx={{ fontSize: 13, color: 'text.secondary', '& p': { m: 0 } }}
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        )}
      </Stack>,
    );

    const popup = new mapboxglRuntime.Popup({ closeButton: false, closeOnClick: false, offset: 20 }).setDOMContent(
      container,
    );
    const marker = new mapboxglRuntime.Marker()
      .setLngLat([place.lng, place.lat])
      .setPopup(popup)
      .addTo(map);
    marker.togglePopup();

    function handleMapClick() {
      setSelectedPlace(null);
    }
    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      marker.remove();
      root.unmount();
    };
  }, [map, selectedPlace]);

  function handleInputChange(_e: unknown, value: string, reason: string) {
    setInputValue(value);
    applyDebouncedQuery(value);
    if (reason === 'input' || reason === 'clear') setSelectedPlace(null);
  }

  function handleSelect(_e: unknown, place: PlaceResultDTO | null) {
    setSelectedPlace(place);
    if (place && map) {
      map.flyTo({ center: [place.lng, place.lat], zoom: 14 });
    }
  }

  return (
    <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      <Autocomplete
        options={options ?? []}
        getOptionLabel={(option) => option.name}
        filterOptions={(x) => x}
        isOptionEqualToValue={(option, value) => option.placeId === value.placeId}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleSelect}
        loading={isFetching}
        renderOption={(props, option) => (
          <li {...props} key={option.placeId}>
            <Stack>
              <Typography variant="body2">{option.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {option.formattedAddress}
              </Typography>
            </Stack>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search for a place"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b', borderRadius: 1 },
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isFetching ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {selectedPlace && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1} spacing={1}>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 180 }}>
            {selectedPlace.formattedAddress}
          </Typography>
          <Tooltip
            title={
              !activeLayerId
                ? 'Select a layer first'
                : !canAddFeatures
                  ? 'Select one of your own layers first'
                  : 'Add pin at this location'
            }
          >
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={!activeLayerId || !canAddFeatures || addPinMutation.isPending}
                onClick={() => addPinMutation.mutate(selectedPlace)}
                aria-label="Add pin at this location"
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )}
    </Box>
  );
}
