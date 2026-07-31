import dns from 'node:dns/promises';
import { safeFetch, UnsafeUrlError } from './safeFetch';

jest.mock('node:dns/promises');

const mockLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

describe('safeFetch', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects non-http(s) protocols', async () => {
    await expect(safeFetch('file:///etc/passwd', {})).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects localhost by hostname', async () => {
    await expect(safeFetch('http://localhost:1234/data', {})).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a hostname that resolves to a private address', async () => {
    mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);
    await expect(safeFetch('http://internal.example.com/data', {})).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a hostname that resolves to a loopback address', async () => {
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(safeFetch('http://sneaky.example.com/data', {})).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects a literal private IP given directly as the hostname', async () => {
    await expect(safeFetch('http://169.254.169.254/latest/meta-data', {})).rejects.toThrow(UnsafeUrlError);
  });

  it('fetches when the hostname resolves to a public address', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await safeFetch('http://public.example.com/data', { headers: { Accept: 'application/json' } });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://public.example.com/data',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });
});
