import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import type { PlaceResultDTO } from '@mapinski/shared';
import type mapboxgl from 'mapbox-gl';
import { searchPlaces } from './api';
import { createFeature, featuresQueryKey } from '../mapFeatures/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';

interface SearchBoxProps {
  map: mapboxgl.Map | null;
  activeLayerId: string | null;
}

export function SearchBox({ map, activeLayerId }: SearchBoxProps) {
  const queryClient = useQueryClient();
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
        properties: { title: place.name },
      }),
    onSuccess: () => {
      if (activeLayerId) queryClient.invalidateQueries({ queryKey: featuresQueryKey(activeLayerId) });
      setSelectedPlace(null);
    },
  });

  function handleInputChange(_e: unknown, value: string) {
    setInputValue(value);
    applyDebouncedQuery(value);
  }

  function handleSelect(_e: unknown, place: PlaceResultDTO | null) {
    setSelectedPlace(place);
    if (place && map) {
      map.flyTo({ center: [place.lng, place.lat], zoom: 14 });
    }
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        width: 360,
        p: 1,
      }}
    >
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
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
            {selectedPlace.formattedAddress}
          </Typography>
          <Button
            size="small"
            variant="contained"
            disabled={!activeLayerId || addPinMutation.isPending}
            onClick={() => addPinMutation.mutate(selectedPlace)}
          >
            Add pin here
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
