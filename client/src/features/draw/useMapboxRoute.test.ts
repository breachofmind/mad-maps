import { act, renderHook } from '@testing-library/react';
// ../map/mapbox reads import.meta.env at module scope, which ts-jest's
// CommonJS output can't parse — stub it out before useMapboxRoute (which
// imports it transitively) is required.
jest.mock('../map/mapbox', () => ({ mapboxgl: { accessToken: 'test-token' } }));
import { useMapboxRoute } from './useMapboxRoute';

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
    expect(map.addLayer).toHaveBeenCalledTimes(4);
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

  it('does not draw the preview when the tool is inactive', () => {
    const { map, fire, lastSetDataFeatures } = createFakeMap();
    renderHook(() => useMapboxRoute({ map: map as never, active: false, profile: 'walking', onCreate: jest.fn() }));

    act(() => {
      fire('click', { lngLat: { lng: -122.4, lat: 37.7 } });
      fire('mousemove', { lngLat: { lng: -122.41, lat: 37.71 } });
    });

    expect(lastSetDataFeatures()).toHaveLength(0);
  });
});
