import { PMTiles, TileType } from 'pmtiles';
import type { PmtilesLayerMeta, PmtilesMetadata } from '@mad-maps/shared';
import { SafeFetchSource } from '../lib/pmtilesSource';
import { UnsafeUrlError } from '../lib/safeFetch';

const INSPECT_TIMEOUT_MS = 10_000;
const KNOWN_FIELD_TYPES = new Set(['Number', 'String', 'Boolean']);

export class PmtilesInspectError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new PmtilesInspectError('Timed out reading the PMTiles archive', 502)), ms);
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

// Real-world archives (e.g. built with tippecanoe) declare field types from
// a fixed set, but this is arbitrary user-supplied JSON — an unrecognized
// value is coerced to 'String' rather than rejecting the whole archive over
// one odd field.
function normalizeFields(fields: unknown): Record<string, 'Number' | 'String' | 'Boolean'> {
  const result: Record<string, 'Number' | 'String' | 'Boolean'> = {};
  if (!fields || typeof fields !== 'object') return result;
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    result[key] = KNOWN_FIELD_TYPES.has(value as string) ? (value as 'Number' | 'String' | 'Boolean') : 'String';
  }
  return result;
}

// Reads just the header + metadata block of a remote PMTiles archive (a
// couple of small HTTP range requests, not the tile data itself) to
// validate the URL before a layer is created and to auto-populate the
// source-layer picker in AddExternalLayerDialog. Never fetches tiles.
export async function inspectPmtiles(url: string): Promise<PmtilesMetadata> {
  const pmtiles = new PMTiles(new SafeFetchSource(url));

  let header: Awaited<ReturnType<typeof pmtiles.getHeader>>;
  try {
    header = await withTimeout(pmtiles.getHeader(), INSPECT_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new PmtilesInspectError(err.message, 400);
    if (err instanceof PmtilesInspectError) throw err;
    throw new PmtilesInspectError("Couldn't read that as a PMTiles archive", 502);
  }

  if (header.tileType !== TileType.Mvt) {
    throw new PmtilesInspectError('Only vector (MVT) PMTiles archives are supported', 400);
  }

  let rawMetadata: unknown;
  try {
    rawMetadata = await withTimeout(pmtiles.getMetadata(), INSPECT_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof PmtilesInspectError) throw err;
    throw new PmtilesInspectError("Couldn't read the PMTiles archive's metadata", 502);
  }

  const vectorLayers = (rawMetadata as { vector_layers?: unknown[] } | null)?.vector_layers;
  const layers: PmtilesLayerMeta[] = Array.isArray(vectorLayers)
    ? vectorLayers
        .filter((layer): layer is Record<string, unknown> => Boolean(layer) && typeof layer === 'object')
        .map((layer) => ({
          id: String(layer.id ?? ''),
          fields: normalizeFields(layer.fields),
          description: typeof layer.description === 'string' ? layer.description : undefined,
          minzoom: typeof layer.minzoom === 'number' ? layer.minzoom : undefined,
          maxzoom: typeof layer.maxzoom === 'number' ? layer.maxzoom : undefined,
        }))
        .filter((layer) => layer.id.length > 0)
    : [];

  if (layers.length === 0) {
    throw new PmtilesInspectError('No vector layers found in that PMTiles archive', 400);
  }

  return {
    layers,
    minzoom: header.minZoom,
    maxzoom: header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
  };
}
