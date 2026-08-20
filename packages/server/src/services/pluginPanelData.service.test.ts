import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import { getPlugin } from '../plugins/pluginRegistry';
import { getMapForOwner } from './maps.service';
import { getPluginPanelData, PluginPanelDataError } from './pluginPanelData.service';
import type { Layer, MapFeatureProperties, Map as MapRow } from '../db/schema';
import type { FeatureRow } from './features.service';

jest.mock('../lib/safeFetch');
jest.mock('../plugins/pluginRegistry');
jest.mock('./maps.service');

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;
const mockGetPlugin = getPlugin as jest.MockedFunction<typeof getPlugin>;
const mockGetMapForOwner = getMapForOwner as jest.MockedFunction<typeof getMapForOwner>;

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number; headers?: Record<string, string> }) {
  const text = JSON.stringify(body);
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    headers: { get: (name: string) => init?.headers?.[name.toLowerCase()] ?? null },
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new TextEncoder().encode(text) };
          },
          cancel: async () => {},
        };
      },
    },
  } as unknown as Response;
}

function makeLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'layer-1',
    mapId: 'map-1',
    name: 'Weather Pins',
    orderIndex: 0,
    visible: true,
    color: '#1976d2',
    defaultIcon: 'marker',
    opacity: 1,
    sourceType: 'local',
    sourceUrl: null,
    sourceLayer: null,
    pmtilesMetadata: null,
    styleConfig: null,
    pluginEndpointUrl: 'https://plugin.example.com/weather',
    pluginId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeFeature(overrides: Partial<FeatureRow> = {}): FeatureRow {
  const properties: MapFeatureProperties = {
    title: 'Home',
    descriptionHtml: '',
    icon: 'marker',
    color: '#1976d2',
  };
  return {
    id: 'feature-1',
    layerId: 'layer-1',
    orderIndex: 0,
    featureType: 'point',
    geometry: JSON.stringify({ type: 'Point', coordinates: [-122.4, 45.5] }),
    properties,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeMap(overrides: Partial<MapRow> = {}): MapRow {
  return {
    id: 'map-1',
    ownerId: 'owner-1',
    title: 'My Map',
    description: null,
    baseStyle: 'mapbox://styles/mapbox/streets-v12',
    defaultCenter: { lng: 0, lat: 0 },
    defaultZoom: 3.5,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const validResponse = { blocks: [{ type: 'heading', text: '5-Day Forecast' }] };

describe('getPluginPanelData', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches, validates, and returns a valid plugin panel response', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validResponse));

    const data = await getPluginPanelData('owner-1', makeLayer(), makeFeature());

    expect(data).toEqual(validResponse);
    expect(mockSafeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockSafeFetch.mock.calls[0];
    expect(url).toBe('https://plugin.example.com/weather');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      feature: {
        id: 'feature-1',
        type: 'point',
        geometry: { type: 'Point', coordinates: [-122.4, 45.5] },
        properties: { title: 'Home' },
      },
      layer: { id: 'layer-1', name: 'Weather Pins' },
    });
  });

  it('rejects when the layer has no plugin endpoint configured', async () => {
    await expect(
      getPluginPanelData('owner-1', makeLayer({ pluginEndpointUrl: null }), makeFeature()),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('caches results per (endpoint, feature) until forced', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validResponse));
    const feature = makeFeature({ id: 'feature-caching-test' });

    await getPluginPanelData('owner-1', makeLayer(), feature);
    await getPluginPanelData('owner-1', makeLayer(), feature);
    expect(mockSafeFetch).toHaveBeenCalledTimes(1);

    await getPluginPanelData('owner-1', makeLayer(), feature, { force: true });
    expect(mockSafeFetch).toHaveBeenCalledTimes(2);
  });

  it('does not share a cache entry across different features on the same endpoint', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validResponse));

    await getPluginPanelData('owner-1', makeLayer(), makeFeature({ id: 'feature-a' }));
    await getPluginPanelData('owner-1', makeLayer(), makeFeature({ id: 'feature-b' }));
    expect(mockSafeFetch).toHaveBeenCalledTimes(2);
  });

  it('wraps an UnsafeUrlError from safeFetch as a 400 PluginPanelDataError', async () => {
    mockSafeFetch.mockRejectedValue(new UnsafeUrlError('nope'));

    await expect(
      getPluginPanelData('owner-1', makeLayer(), makeFeature({ id: 'feature-unsafe' })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns a 502 error for a non-OK upstream response', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    await expect(
      getPluginPanelData('owner-1', makeLayer(), makeFeature({ id: 'feature-broken' })),
    ).rejects.toBeInstanceOf(PluginPanelDataError);
  });

  it('returns a 502 error for a response that fails schema validation', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse({ blocks: [{ type: 'video' }] }));

    await expect(
      getPluginPanelData('owner-1', makeLayer(), makeFeature({ id: 'feature-invalid' })),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('returns a 502 error when the declared content-length exceeds the size limit', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validResponse, { headers: { 'content-length': String(1024 * 1024) } }));

    await expect(
      getPluginPanelData('owner-1', makeLayer(), makeFeature({ id: 'feature-huge' })),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('returns a 429 error once an owner exceeds the per-minute request rate limit', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validResponse));

    for (let i = 0; i < 60; i++) {
      await getPluginPanelData('owner-rate-limited', makeLayer(), makeFeature({ id: `feature-rate-${i}` }));
    }

    await expect(
      getPluginPanelData('owner-rate-limited', makeLayer(), makeFeature({ id: 'feature-rate-60' })),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('does not count cache hits against the rate limit', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validResponse));
    const feature = makeFeature({ id: 'feature-cached' });

    for (let i = 0; i < 100; i++) {
      await getPluginPanelData('owner-cache-only', makeLayer(), feature);
    }

    expect(mockSafeFetch).toHaveBeenCalledTimes(1);
  });
});

describe('getPluginPanelData (local plugins)', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function localLayer(overrides: Partial<Layer> = {}) {
    return makeLayer({ pluginEndpointUrl: null, pluginId: 'weather-forecast', ...overrides });
  }

  it('calls the plugin handler with rich feature/layer/map context and returns its blocks', async () => {
    const handler = jest.fn().mockResolvedValue(validResponse);
    mockGetPlugin.mockReturnValue({ id: 'weather-forecast', name: 'Weather Forecast', description: 'd', handler });
    mockGetMapForOwner.mockResolvedValue(makeMap());

    const feature = makeFeature({
      id: 'feature-local-1',
      properties: { title: 'Home', descriptionHtml: '<p>hi</p>', icon: 'marker', color: '#ff0000' },
    });

    const data = await getPluginPanelData('owner-1', localLayer(), feature);

    expect(data).toEqual(validResponse);
    expect(mockSafeFetch).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith({
      feature: {
        id: 'feature-local-1',
        type: 'point',
        geometry: { type: 'Point', coordinates: [-122.4, 45.5] },
        properties: { title: 'Home', descriptionHtml: '<p>hi</p>', icon: 'marker', color: '#ff0000' },
      },
      layer: { id: 'layer-1', name: 'Weather Pins' },
      map: { id: 'map-1', title: 'My Map' },
    });
  });

  it('supports a synchronous (non-Promise) handler', async () => {
    const handler = jest.fn().mockReturnValue(validResponse);
    mockGetPlugin.mockReturnValue({ id: 'weather-forecast', name: 'Weather Forecast', description: 'd', handler });
    mockGetMapForOwner.mockResolvedValue(makeMap());

    const data = await getPluginPanelData('owner-1', localLayer(), makeFeature({ id: 'feature-local-sync' }));

    expect(data).toEqual(validResponse);
  });

  it('returns a 400 error when the configured pluginId is no longer loaded', async () => {
    mockGetPlugin.mockReturnValue(undefined);

    await expect(
      getPluginPanelData('owner-1', localLayer(), makeFeature({ id: 'feature-local-missing' })),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockGetMapForOwner).not.toHaveBeenCalled();
  });

  it('wraps a handler that throws as a 500 PluginPanelDataError', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    mockGetPlugin.mockReturnValue({ id: 'weather-forecast', name: 'Weather Forecast', description: 'd', handler });
    mockGetMapForOwner.mockResolvedValue(makeMap());

    await expect(
      getPluginPanelData('owner-1', localLayer(), makeFeature({ id: 'feature-local-throws' })),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it('returns a 500 error when the handler resolves to an invalid plugin panel response', async () => {
    const handler = jest.fn().mockResolvedValue({ blocks: [{ type: 'video' }] });
    mockGetPlugin.mockReturnValue({ id: 'weather-forecast', name: 'Weather Forecast', description: 'd', handler });
    mockGetMapForOwner.mockResolvedValue(makeMap());

    await expect(
      getPluginPanelData('owner-1', localLayer(), makeFeature({ id: 'feature-local-invalid' })),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it('times out a hanging handler', async () => {
    jest.useFakeTimers();
    const handler = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
    mockGetPlugin.mockReturnValue({ id: 'weather-forecast', name: 'Weather Forecast', description: 'd', handler });
    mockGetMapForOwner.mockResolvedValue(makeMap());

    const assertion = expect(
      getPluginPanelData('owner-1', localLayer(), makeFeature({ id: 'feature-local-hangs' })),
    ).rejects.toMatchObject({ statusCode: 504 });
    await jest.advanceTimersByTimeAsync(10_000);
    await assertion;

    jest.useRealTimers();
  });

  it('caches local plugin results per (pluginId, feature) separately from url-based entries', async () => {
    const handler = jest.fn().mockResolvedValue(validResponse);
    mockGetPlugin.mockReturnValue({ id: 'weather-forecast', name: 'Weather Forecast', description: 'd', handler });
    mockGetMapForOwner.mockResolvedValue(makeMap());
    const feature = makeFeature({ id: 'feature-local-cache' });

    await getPluginPanelData('owner-1', localLayer(), feature);
    await getPluginPanelData('owner-1', localLayer(), feature);
    expect(handler).toHaveBeenCalledTimes(1);

    await getPluginPanelData('owner-1', localLayer(), feature, { force: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
