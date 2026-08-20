import { pluginPanelResponseSchema, type PluginPanelRequestBody, type PluginPanelResponse } from '@mad-maps/shared';
import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import type { FeatureRow } from './features.service';
import type { Layer } from '../db/schema';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 512 * 1024;
const CACHE_TTL_MS = 5 * 60 * 1000;

// Fires on every feature selection rather than on infrequent layer
// create/edit like the geojson-url pipeline this is modeled on — bounded
// per owner so a user rapidly clicking around a map can't be used to hammer
// an arbitrary third-party endpoint through Mad Maps' server.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const requestTimestampsByOwner = new Map<string, number[]>();

export class PluginPanelDataError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function checkRateLimit(ownerId: string): void {
  const now = Date.now();
  const timestamps = (requestTimestampsByOwner.get(ownerId) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestTimestampsByOwner.set(ownerId, timestamps);
    throw new PluginPanelDataError('Too many plugin data requests, try again shortly', 429);
  }
  timestamps.push(now);
  requestTimestampsByOwner.set(ownerId, timestamps);
}

interface CacheEntry {
  data: PluginPanelResponse;
  expiresAt: number;
}

// Keyed by (endpoint URL, feature id) — unlike the geojson-url cache, a
// plugin endpoint's response varies per feature, not just per URL.
const cache = new Map<string, CacheEntry>();

function cacheKey(endpointUrl: string, featureId: string): string {
  return `${endpointUrl}::${featureId}`;
}

async function readBodyWithLimit(response: Response): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new PluginPanelDataError('Plugin endpoint response exceeds the size limit', 502);
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new PluginPanelDataError('Plugin endpoint response exceeds the size limit', 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8');
}

function buildRequestBody(layer: Layer, feature: FeatureRow): PluginPanelRequestBody {
  return {
    feature: {
      id: feature.id,
      type: feature.featureType as PluginPanelRequestBody['feature']['type'],
      geometry: JSON.parse(feature.geometry) as GeoJSON.Geometry,
      properties: { title: feature.properties.title },
    },
    layer: { id: layer.id, name: layer.name },
  };
}

async function fetchAndValidate(endpointUrl: string, layer: Layer, feature: FeatureRow): Promise<PluginPanelResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await safeFetch(endpointUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'MadMaps-PluginProxy/1.0' },
      body: JSON.stringify(buildRequestBody(layer, feature)),
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new PluginPanelDataError(err.message, 400);
    throw new PluginPanelDataError('Failed to reach the plugin endpoint', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new PluginPanelDataError(`Plugin endpoint responded with status ${response.status}`, 502);
  }

  const body = await readBodyWithLimit(response);

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new PluginPanelDataError('Plugin endpoint did not return valid JSON', 502);
  }

  const parsed = pluginPanelResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new PluginPanelDataError('Plugin endpoint did not return a valid plugin panel response', 502);
  }

  return parsed.data;
}

export async function getPluginPanelData(
  ownerId: string,
  layer: Layer,
  feature: FeatureRow,
  options?: { force?: boolean },
): Promise<PluginPanelResponse> {
  if (!layer.pluginEndpointUrl) {
    throw new PluginPanelDataError('Layer has no plugin endpoint configured', 400);
  }

  const key = cacheKey(layer.pluginEndpointUrl, feature.id);
  const cached = cache.get(key);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  checkRateLimit(ownerId);

  const data = await fetchAndValidate(layer.pluginEndpointUrl, layer, feature);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
