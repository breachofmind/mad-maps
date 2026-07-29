import type { PlaceResultDTO } from '@mapinski/shared';
import { env } from '../config/env';

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location';

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

interface GooglePlacesSearchResponse {
  places?: GooglePlace[];
}

export async function searchPlaces(query: string): Promise<PlaceResultDTO[]> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  const response = await fetch(SEARCH_TEXT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query }),
  });

  if (!response.ok) {
    throw new Error(`Google Places API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GooglePlacesSearchResponse;

  return (data.places ?? []).map((place) => ({
    placeId: place.id,
    name: place.displayName?.text ?? '',
    formattedAddress: place.formattedAddress ?? '',
    lng: place.location?.longitude ?? 0,
    lat: place.location?.latitude ?? 0,
  }));
}
