import { env } from '../config/env';
import { searchPlaces } from './googlePlaces.service';

describe('searchPlaces', () => {
  const originalApiKey = env.GOOGLE_MAPS_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    env.GOOGLE_MAPS_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws a clear error when GOOGLE_MAPS_API_KEY is not configured', async () => {
    env.GOOGLE_MAPS_API_KEY = '';
    await expect(searchPlaces('golden gate park')).rejects.toThrow('GOOGLE_MAPS_API_KEY is not configured');
  });

  it('sends the query, API key, and field mask, mapping the response to PlaceResultDTO[]', async () => {
    env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    const mockResponse = {
      places: [
        {
          id: 'place-1',
          displayName: { text: 'Golden Gate Park' },
          formattedAddress: 'San Francisco, CA, USA',
          location: { latitude: 37.7694, longitude: -122.4862 },
          googleMapsUri: 'https://maps.google.com/?cid=12345',
          rating: 4.6,
          userRatingCount: 12345,
        },
      ],
    };
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const results = await searchPlaces('golden gate park');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Goog-Api-Key': 'test-api-key',
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.rating,places.userRatingCount',
        }),
        body: JSON.stringify({ textQuery: 'golden gate park' }),
      }),
    );
    expect(results).toEqual([
      {
        placeId: 'place-1',
        name: 'Golden Gate Park',
        formattedAddress: 'San Francisco, CA, USA',
        lng: -122.4862,
        lat: 37.7694,
        googleMapsUri: 'https://maps.google.com/?cid=12345',
        rating: 4.6,
        userRatingCount: 12345,
      },
    ]);
  });

  it('maps missing displayName/formattedAddress/location to safe defaults', async () => {
    env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ places: [{ id: 'place-2' }] }),
    }) as unknown as typeof fetch;

    const results = await searchPlaces('somewhere');

    expect(results).toEqual([
      {
        placeId: 'place-2',
        name: '',
        formattedAddress: '',
        lng: 0,
        lat: 0,
        googleMapsUri: null,
        rating: null,
        userRatingCount: null,
      },
    ]);
  });

  it('returns an empty array when the response has no places', async () => {
    env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    expect(await searchPlaces('nowhere')).toEqual([]);
  });

  it('throws when the Google API responds with a non-OK status', async () => {
    env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(searchPlaces('too many requests')).rejects.toThrow('status 429');
  });
});
