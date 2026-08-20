import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import { getPlugin } from '../plugins/pluginRegistry';
import { getPluginMetadata, PluginMetadataError } from './pluginMetadata.service';
import type { Layer } from '../db/schema';

jest.mock('../lib/safeFetch');
jest.mock('../plugins/pluginRegistry');

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;
const mockGetPlugin = getPlugin as jest.MockedFunction<typeof getPlugin>;

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

const validMetadata = { name: 'Weather Forecast', description: 'A 5-day forecast' };

describe('getPluginMetadata (url plugins)', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('GETs and validates metadata from the plugin endpoint', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validMetadata));

    const data = await getPluginMetadata(makeLayer());

    expect(data).toEqual(validMetadata);
    const [url, init] = mockSafeFetch.mock.calls[0];
    expect(url).toBe('https://plugin.example.com/weather');
    expect(init?.method).toBe('GET');
  });

  it('caches metadata per URL until forced', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validMetadata));
    const layer = makeLayer({ pluginEndpointUrl: 'https://plugin.example.com/caching-test' });

    await getPluginMetadata(layer);
    await getPluginMetadata(layer);
    expect(mockSafeFetch).toHaveBeenCalledTimes(1);

    await getPluginMetadata(layer, { force: true });
    expect(mockSafeFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects when the layer has no plugin configured', async () => {
    await expect(
      getPluginMetadata(makeLayer({ pluginEndpointUrl: null })),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('wraps an UnsafeUrlError from safeFetch as a 400', async () => {
    mockSafeFetch.mockRejectedValue(new UnsafeUrlError('nope'));

    await expect(
      getPluginMetadata(makeLayer({ pluginEndpointUrl: 'https://plugin.example.com/blocked' })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns a 502 for a non-OK response', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    await expect(
      getPluginMetadata(makeLayer({ pluginEndpointUrl: 'https://plugin.example.com/broken' })),
    ).rejects.toBeInstanceOf(PluginMetadataError);
  });

  it('returns a 502 for a response that fails schema validation', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse({ name: '' }));

    await expect(
      getPluginMetadata(makeLayer({ pluginEndpointUrl: 'https://plugin.example.com/invalid' })),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe('getPluginMetadata (local plugins)', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the registry name/description directly, without any fetch', async () => {
    mockGetPlugin.mockReturnValue({
      id: 'weather-forecast',
      name: 'Weather Forecast',
      description: 'A forecast',
      handler: () => ({ blocks: [] }),
    });

    const data = await getPluginMetadata(makeLayer({ pluginEndpointUrl: null, pluginId: 'weather-forecast' }));

    expect(data).toEqual({ name: 'Weather Forecast', description: 'A forecast' });
    expect(mockSafeFetch).not.toHaveBeenCalled();
  });

  it('returns a 400 error when the configured pluginId is no longer loaded', async () => {
    mockGetPlugin.mockReturnValue(undefined);

    await expect(
      getPluginMetadata(makeLayer({ pluginEndpointUrl: null, pluginId: 'missing' })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
