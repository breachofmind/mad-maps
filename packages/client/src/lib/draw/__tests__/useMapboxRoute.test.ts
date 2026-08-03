import { act, renderHook } from '@testing-library/react';
// ../map/mapbox reads import.meta.env at module scope, which ts-jest's
// CommonJS output can't parse — stub it out before useMapboxRoute (which
// imports it transitively) is required.
jest.mock('../../map/mapbox', () => ({ mapboxgl: { accessToken: 'test-token' } }));
import { useMapboxRoute } from '../useMapboxRoute';

type Handler = (e: unknown) => void;

function createFakeMap() {
  const handlers: Record<string, Handler[]> = {};
  const layers = new Set<string>();
  let source: { setData: jest.Mock } | null = null;

  const map = {
    isStyleLoaded: () => true,
    on: jest.fn((event: string, cb: Handler) => {
      (handlers[event] ??= []).push(cb);
    }),
    off: jest.fn((event: string, cb: Handler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    addSource: jest.fn(() => {
      source = { setData: jest.fn() };
    }),
    getSource: jest.fn(() => source ?? undefined),
    addLayer: jest.fn((layer: { id: string }) => layers.add(layer.id)),
    getLayer: jest.fn((id: string) => (layers.has(id) ? {} : undefined)),
    removeLayer: jest.fn((id: string) => layers.delete(id)),
    removeSource: jest.fn(() => {
      source = null;
    }),
    setPaintProperty: jest.fn(),
  };

  function fire(event: string, payload: unknown) {
    (handlers[event] ?? []).forEach((h) => h(payload));
  }

  function lastSetDataFeatures() {
    const calls = source?.setData.mock.calls ?? [];
    const last = calls[calls.length - 1]?.[0] as GeoJSON.FeatureCollection | undefined;
    return last?.features ?? [];
  }

  return { map, fire, lastSetDataFeatures };
}

describe('useMapboxRoute', () => {
  it('registers the preview source and layers once the map is ready', () => {
    const { map } = createFakeMap();
    renderHook(() =>
      useMapboxRoute({ map: map as never, active: true, profile: 'walking', onCreate: jest.fn() }),
    );

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.addLayer).toHaveBeenCalledTimes(3);
  });

  it('draws a rubber-band line from the last placed waypoint to the cursor', () => {
    const { map, fire, lastSetDataFeatures } = createFakeMap();
    const { result } = renderHook(() =>
      useMapboxRoute({ map: map as never, active: true, profile: 'walking', onCreate: jest.fn() }),
    );

    act(() => {
      fire('click', { lngLat: { lng: -122.4, lat: 37.7 } });
    });
    expect(result.current.waypointCount).toBe(1);
    // A single waypoint with no cursor position yet shouldn't draw a line.
    expect(lastSetDataFeatures().some((f) => f.properties?.role === 'waypointLine')).toBe(false);

    act(() => {
      fire('mousemove', { lngLat: { lng: -122.41, lat: 37.71 } });
    });

    const line = lastSetDataFeatures().find((f) => f.properties?.role === 'waypointLine');
    expect(line).toBeDefined();
    expect(line?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-122.4, 37.7],
        [-122.41, 37.71],
      ],
    });
  });

  it('attaches distance, duration, and profile to the finished feature', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-122.4, 37.7],
                [-122.41, 37.71],
              ],
            },
            distance: 1500,
            duration: 300,
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const onCreate = jest.fn();
    const { map, fire } = createFakeMap();
    const { result } = renderHook(() =>
      useMapboxRoute({ map: map as never, active: true, profile: 'driving', onCreate }),
    );

    await act(async () => {
      fire('click', { lngLat: { lng: -122.4, lat: 37.7 } });
      fire('click', { lngLat: { lng: -122.41, lat: 37.71 } });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.distanceMeters).toBe(1500);
    expect(result.current.durationSeconds).toBe(300);

    act(() => {
      result.current.finish();
    });

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: { distanceMeters: 1500, durationSeconds: 300, profile: 'driving' },
      }),
    );
  });

  it('does not draw the preview when the tool is inactive', () => {
    const { map, fire, lastSetDataFeatures } = createFakeMap();
    renderHook(() => useMapboxRoute({ map: map as never, active: false, profile: 'walking', onCreate: jest.fn() }));

    act(() => {
      fire('click', { lngLat: { lng: -122.4, lat: 37.7 } });
      fire('mousemove', { lngLat: { lng: -122.41, lat: 37.71 } });
    });

    expect(lastSetDataFeatures()).toHaveLength(0);
  });

  it('pulses the waypoint line opacity while active', () => {
    jest.useFakeTimers();
    try {
      const { map } = createFakeMap();
      renderHook(() =>
        useMapboxRoute({ map: map as never, active: true, profile: 'walking', onCreate: jest.fn() }),
      );

      // Sets up the transition once, then flips opacity on the initial
      // pulse plus at least one full interval tick.
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const opacityCalls = map.setPaintProperty.mock.calls.filter(
        (call) => call[0] === 'mapinski-route-preview-waypoint-line' && call[1] === 'line-opacity',
      );
      expect(opacityCalls.length).toBeGreaterThanOrEqual(2);
      const values = opacityCalls.map((call) => call[2]);
      // Alternates between the two pulse extremes rather than the same
      // value repeating.
      expect(new Set(values).size).toBe(2);

      const transitionCall = map.setPaintProperty.mock.calls.find(
        (call) => call[0] === 'mapinski-route-preview-waypoint-line' && call[1] === 'line-opacity-transition',
      );
      expect(transitionCall).toBeDefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops pulsing and restores full opacity once the tool goes inactive', () => {
    jest.useFakeTimers();
    try {
      const { map } = createFakeMap();
      const { rerender } = renderHook(
        ({ active }) => useMapboxRoute({ map: map as never, active, profile: 'walking', onCreate: jest.fn() }),
        { initialProps: { active: true } },
      );

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      const callsWhileActive = map.setPaintProperty.mock.calls.length;
      expect(callsWhileActive).toBeGreaterThan(0);

      map.setPaintProperty.mockClear();
      rerender({ active: false });

      expect(map.setPaintProperty).toHaveBeenCalledWith(
        'mapinski-route-preview-waypoint-line',
        'line-opacity',
        1,
      );

      map.setPaintProperty.mockClear();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(map.setPaintProperty).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
