import { pluginPanelResponseSchema, type PluginPanelRequestBody, type PluginPanelResponse } from '@mad-maps/shared';
import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import { readBodyWithLimit } from '../lib/readBodyWithLimit';
import { getPlugin, type PluginHandlerArgs } from '../plugins/pluginRegistry';
import { getMapForOwner } from './maps.service';
import type { FeatureRow } from './features.service';
import type { Layer } from '../db/schema';

const FETCH_TIMEOUT_MS = 10_000;
const PLUGIN_HANDLER_TIMEOUT_MS = 10_000;
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

// Keyed by (source, identifier, feature id) — unlike the geojson-url cache,
// a plugin's response varies per feature, not just per source. The 'local:'/
// 'url:' prefix keeps the two id spaces (plugin id vs URL) from ever
// colliding in this shared map.
const cache = new Map<string, CacheEntry>();

function cacheKey(source: 'local' | 'url', identifier: string, featureId: string): string {
  return `${source}:${identifier}::${featureId}`;
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

  const body = await readBodyWithLimit(response, MAX_RESPONSE_BYTES, () => {
    throw new PluginPanelDataError('Plugin endpoint response exceeds the size limit', 502);
  });

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

function withTimeout<T>(promise: Promise<T>, ms: number, error: PluginPanelDataError): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(error), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// Local plugins are files the server operator placed on disk themselves —
// a different trust level than a third-party URL — so handlers receive the
// feature's full properties and basic layer/map context, not just the
// minimal {id, type, geometry, title} the external URL contract sends.
async function runLocalPlugin(ownerId: string, layer: Layer, feature: FeatureRow): Promise<PluginPanelResponse> {
  const plugin = getPlugin(layer.pluginId!);
  if (!plugin) {
    throw new PluginPanelDataError('Configured plugin is no longer available', 400);
  }

  const map = await getMapForOwner(layer.mapId, ownerId);
  if (!map) {
    throw new PluginPanelDataError('Map not found', 404);
  }

  const args: PluginHandlerArgs = {
    feature: {
      id: feature.id,
      type: feature.featureType as PluginHandlerArgs['feature']['type'],
      geometry: JSON.parse(feature.geometry) as GeoJSON.Geometry,
      properties: feature.properties,
    },
    layer: { id: layer.id, name: layer.name },
    map: { id: map.id, title: map.title },
  };

  let result: PluginPanelResponse;
  try {
    result = await withTimeout(
      Promise.resolve(plugin.handler(args)),
      PLUGIN_HANDLER_TIMEOUT_MS,
      new PluginPanelDataError('Plugin handler timed out', 504),
    );
  } catch (err) {
    if (err instanceof PluginPanelDataError) throw err;
    throw new PluginPanelDataError(`Plugin handler threw: ${(err as Error).message}`, 500);
  }

  const parsed = pluginPanelResponseSchema.safeParse(result);
  if (!parsed.success) {
    throw new PluginPanelDataError('Plugin handler did not return a valid plugin panel response', 500);
  }
  return parsed.data;
}

export async function getPluginPanelData(
  ownerId: string,
  layer: Layer,
  feature: FeatureRow,
  options?: { force?: boolean },
): Promise<PluginPanelResponse> {
  if (!layer.pluginEndpointUrl && !layer.pluginId) {
    throw new PluginPanelDataError('Layer has no plugin configured', 400);
  }

  const key = layer.pluginId
    ? cacheKey('local', layer.pluginId, feature.id)
    : cacheKey('url', layer.pluginEndpointUrl!, feature.id);
  const cached = cache.get(key);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  checkRateLimit(ownerId);

  const data = layer.pluginId
    ? await runLocalPlugin(ownerId, layer, feature)
    : await fetchAndValidate(layer.pluginEndpointUrl!, layer, feature);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
