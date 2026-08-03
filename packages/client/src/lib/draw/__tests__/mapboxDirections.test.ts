import { fetchDirectionsRoute, formatDuration } from '../mapboxDirections';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('fetchDirectionsRoute', () => {
  it('requests the walking profile with the given waypoints and returns the snapped route', async () => {
    const route = {
      geometry: { type: 'LineString', coordinates: [[-122.4, 37.7], [-122.41, 37.71]] },
      distance: 1234.5,
      duration: 600,
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [route] }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchDirectionsRoute(
      [
        [-122.4, 37.7],
        [-122.41, 37.71],
      ],
      'walking',
      'test-token',
    );

    expect(result).toEqual({
      geometry: route.geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    });

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe('/directions/v5/mapbox/walking/-122.4,37.7;-122.41,37.71');
    expect(requestedUrl.searchParams.get('geometries')).toBe('geojson');
  });

  it('throws when the request fails', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422 }) as unknown as typeof fetch;

    await expect(
      fetchDirectionsRoute(
        [
          [-122.4, 37.7],
          [-122.41, 37.71],
        ],
        'driving',
        'test-token',
      ),
    ).rejects.toThrow('422');
  });

  it('throws when no route is found', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ routes: [] }),
    }) as unknown as typeof fetch;

    await expect(
      fetchDirectionsRoute(
        [
          [-122.4, 37.7],
          [-122.41, 37.71],
        ],
        'cycling',
        'test-token',
      ),
    ).rejects.toThrow('No route found');
  });
});

describe('formatDuration', () => {
  it('formats under an hour as minutes', () => {
    expect(formatDuration(600)).toBe('10 min');
  });

  it('rounds to the nearest minute', () => {
    expect(formatDuration(89)).toBe('1 min');
    expect(formatDuration(91)).toBe('2 min');
  });

  it('floors a very short duration at 1 minute rather than showing 0', () => {
    expect(formatDuration(10)).toBe('1 min');
  });

  it('formats an hour or more as hours and minutes', () => {
    expect(formatDuration(4500)).toBe('1 hr 15 min');
  });

  it('omits minutes when the duration is an exact number of hours', () => {
    expect(formatDuration(7200)).toBe('2 hr');
  });
});
