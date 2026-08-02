import { safeFetch } from './safeFetch';
import { SafeFetchSource } from './pmtilesSource';

jest.mock('./safeFetch');

const mockSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;

function response(init: { status?: number; headers?: Record<string, string>; body?: ArrayBuffer }) {
  return {
    status: init.status ?? 200,
    headers: { get: (name: string) => init.headers?.[name.toLowerCase()] ?? null },
    arrayBuffer: async () => init.body ?? new ArrayBuffer(8),
  } as unknown as Response;
}

describe('SafeFetchSource', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('requests the given byte range via safeFetch', async () => {
    mockSafeFetch.mockResolvedValue(response({ status: 206 }));
    const source = new SafeFetchSource('https://example.com/archive.pmtiles');

    await source.getBytes(100, 50);

    expect(mockSafeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockSafeFetch.mock.calls[0];
    expect(url).toBe('https://example.com/archive.pmtiles');
    expect((init.headers as Headers).get('range')).toBe('bytes=100-149');
  });

  it('retries a 416 on the initial read using the actual length from Content-Range', async () => {
    mockSafeFetch
      .mockResolvedValueOnce(response({ status: 416, headers: { 'content-range': 'bytes */42' } }))
      .mockResolvedValueOnce(response({ status: 200 }));
    const source = new SafeFetchSource('https://example.com/small.pmtiles');

    await source.getBytes(0, 16384);

    expect(mockSafeFetch).toHaveBeenCalledTimes(2);
    const secondInit = mockSafeFetch.mock.calls[1][1];
    expect((secondInit.headers as Headers).get('range')).toBe('bytes=0-41');
  });

  it('throws when a 416 on the initial read has no usable Content-Range', async () => {
    mockSafeFetch.mockResolvedValue(response({ status: 416 }));
    const source = new SafeFetchSource('https://example.com/broken.pmtiles');

    await expect(source.getBytes(0, 16384)).rejects.toThrow('Missing content-length on 416 response');
  });

  it('throws on a non-success response status', async () => {
    mockSafeFetch.mockResolvedValue(response({ status: 500 }));
    const source = new SafeFetchSource('https://example.com/error.pmtiles');

    await expect(source.getBytes(0, 100)).rejects.toThrow('Bad response code: 500');
  });

  it('propagates a safeFetch SSRF rejection to the caller', async () => {
    const { UnsafeUrlError } = jest.requireActual('./safeFetch');
    mockSafeFetch.mockRejectedValue(new UnsafeUrlError('blocked'));
    const source = new SafeFetchSource('http://169.254.169.254/archive.pmtiles');

    await expect(source.getBytes(0, 100)).rejects.toThrow('blocked');
  });
});
