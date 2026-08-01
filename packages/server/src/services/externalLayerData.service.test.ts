import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import { ExternalLayerDataError, getExternalLayerData } from './externalLayerData.service';

jest.mock('../lib/safeFetch');

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

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

const validCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-122.4, 45.5] }, properties: { name: 'a' } }],
};

describe('getExternalLayerData', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches, validates, and returns a valid FeatureCollection', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validCollection));

    const data = await getExternalLayerData('https://example.com/fires.geojson');

    expect(data).toEqual(validCollection);
    expect(mockSafeFetch).toHaveBeenCalledTimes(1);
  });

  it('caches results per URL until forced', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validCollection));

    await getExternalLayerData('https://example.com/cached.geojson');
    await getExternalLayerData('https://example.com/cached.geojson');
    expect(mockSafeFetch).toHaveBeenCalledTimes(1);

    await getExternalLayerData('https://example.com/cached.geojson', { force: true });
    expect(mockSafeFetch).toHaveBeenCalledTimes(2);
  });

  it('wraps an UnsafeUrlError from safeFetch as a 400 ExternalLayerDataError', async () => {
    mockSafeFetch.mockRejectedValue(new UnsafeUrlError('nope'));

    await expect(getExternalLayerData('https://example.com/blocked.geojson')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('returns a 502 error for a non-OK upstream response', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));

    await expect(getExternalLayerData('https://example.com/broken.geojson')).rejects.toBeInstanceOf(
      ExternalLayerDataError,
    );
  });

  it('returns a 502 error for a response that is not valid GeoJSON', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse({ type: 'NotGeoJson' }));

    await expect(getExternalLayerData('https://example.com/invalid.geojson')).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('returns a 502 error when the declared content-length exceeds the size limit', async () => {
    mockSafeFetch.mockResolvedValue(jsonResponse(validCollection, { headers: { 'content-length': String(30 * 1024 * 1024) } }));

    await expect(getExternalLayerData('https://example.com/huge.geojson')).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});
