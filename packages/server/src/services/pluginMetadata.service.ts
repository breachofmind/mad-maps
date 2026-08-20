import { pluginMetadataSchema, type PluginMetadata } from '@mad-maps/shared';
import { safeFetch, UnsafeUrlError } from '../lib/safeFetch';
import { readBodyWithLimit } from '../lib/readBodyWithLimit';
import { getPlugin } from '../plugins/pluginRegistry';
import type { Layer } from '../db/schema';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024; // metadata is a tiny {name, description} payload
// Identity info changes far less often than per-feature content, so this is
// cached much longer than the 5-minute plugin-data cache — a courtesy to
// the third-party endpoint, and no dedicated rate limiter is needed here
// for the same reason (the long TTL already sharply bounds call frequency).
const CACHE_TTL_MS = 60 * 60 * 1000;

export class PluginMetadataError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

interface CacheEntry {
  data: PluginMetadata;
  expiresAt: number;
}

// Keyed by endpoint URL only — unlike plugin *data*, a plugin's identity
// doesn't vary per feature.
const cache = new Map<string, CacheEntry>();

async function fetchUrlMetadata(endpointUrl: string): Promise<PluginMetadata> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await safeFetch(endpointUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'MadMaps-PluginProxy/1.0' },
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new PluginMetadataError(err.message, 400);
    throw new PluginMetadataError('Failed to reach the plugin endpoint', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new PluginMetadataError(`Plugin endpoint responded with status ${response.status}`, 502);
  }

  const body = await readBodyWithLimit(response, MAX_RESPONSE_BYTES, () => {
    throw new PluginMetadataError('Plugin endpoint response exceeds the size limit', 502);
  });

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new PluginMetadataError('Plugin endpoint did not return valid JSON', 502);
  }

  const parsed = pluginMetadataSchema.safeParse(json);
  if (!parsed.success) {
    throw new PluginMetadataError('Plugin endpoint did not return valid plugin metadata', 502);
  }

  return parsed.data;
}

export async function getPluginMetadata(layer: Layer, options?: { force?: boolean }): Promise<PluginMetadata> {
  if (layer.pluginId) {
    const plugin = getPlugin(layer.pluginId);
    if (!plugin) {
      throw new PluginMetadataError('Configured plugin is no longer available', 400);
    }
    return { name: plugin.name, description: plugin.description };
  }

  if (!layer.pluginEndpointUrl) {
    throw new PluginMetadataError('Layer has no plugin configured', 400);
  }

  const cached = cache.get(layer.pluginEndpointUrl);
  if (!options?.force && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await fetchUrlMetadata(layer.pluginEndpointUrl);
  cache.set(layer.pluginEndpointUrl, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
