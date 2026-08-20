import { externalGeoJsonFeatureCollectionSchema } from '@mad-maps/shared';
import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import { readBodyWithLimit } from '../lib/readBodyWithLimit';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const CACHE_TTL_MS = 15 * 60 * 1000;

export class ExternalLayerDataError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

interface CacheEntry {
  data: GeoJSON.FeatureCollection;
  expiresAt: number;
}

// Keyed by source URL (not layer id) so multiple layers/maps pointed at the
// same curated dataset share one upstream fetch. Process-local and
// unbounded-but-small in practice — the curated + custom URL set for a
// single server instance stays tiny, so no eviction beyond TTL is needed.
const cache = new Map<string, CacheEntry>();

async function fetchAndValidate(sourceUrl: string): Promise<GeoJSON.FeatureCollection> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await safeFetch(sourceUrl, { signal: controller.signal, headers: { Accept: 'application/geo+json, application/json' } });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new ExternalLayerDataError(err.message, 400);
    throw new ExternalLayerDataError('Failed to reach the external data source', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new ExternalLayerDataError(`External data source responded with status ${response.status}`, 502);
  }

  const body = await readBodyWithLimit(response, MAX_RESPONSE_BYTES, () => {
    throw new ExternalLayerDataError('Upstream response exceeds the size limit', 502);
  });

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ExternalLayerDataError('External data source did not return valid JSON', 502);
  }

  const parsed = externalGeoJsonFeatureCollectionSchema.safeParse(json);
  if (!parsed.success) {
    throw new ExternalLayerDataError('External data source did not return a valid GeoJSON FeatureCollection', 502);
  }

  return parsed.data as GeoJSON.FeatureCollection;
}

export async function getExternalLayerData(sourceUrl: string, options?: { force?: boolean }): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get(sourceUrl);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await fetchAndValidate(sourceUrl);
  cache.set(sourceUrl, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
