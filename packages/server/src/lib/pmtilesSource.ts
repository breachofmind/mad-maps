import type { RangeResponse, Source } from 'pmtiles';
import { safeFetch } from './safeFetch';

// A pmtiles `Source` backed by safeFetch (SSRF-guarded) instead of the
// package's own FetchSource, which calls the global `fetch` directly. Only
// implements what PMTiles.getHeader()/getMetadata() actually exercise (a
// couple of one-shot range reads) — not the etag-mismatch retry dance
// FetchSource does for long-lived tile-serving caches, which doesn't apply
// to a single inspect-and-discard call.
export class SafeFetchSource implements Source {
  constructor(private readonly url: string) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const headers = new Headers();
    headers.set('range', `bytes=${offset}-${offset + length - 1}`);

    let response = await safeFetch(this.url, { signal, headers });

    // Mirrors pmtiles' own FetchSource: a server may 416 an initial
    // (offset 0) range request that overruns a small archive's actual size
    // — retry once with the real length reported in Content-Range.
    if (offset === 0 && response.status === 416) {
      const contentRange = response.headers.get('Content-Range');
      if (!contentRange || !contentRange.startsWith('bytes */')) {
        throw new Error('Missing content-length on 416 response');
      }
      const actualLength = Number(contentRange.slice('bytes */'.length));
      headers.set('range', `bytes=0-${actualLength - 1}`);
      response = await safeFetch(this.url, { signal, headers });
    }

    if (response.status >= 300) {
      throw new Error(`Bad response code: ${response.status}`);
    }

    const data = await response.arrayBuffer();
    return {
      data,
      etag: response.headers.get('Etag') ?? undefined,
      cacheControl: response.headers.get('Cache-Control') ?? undefined,
      expires: response.headers.get('Expires') ?? undefined,
    };
  }
}
