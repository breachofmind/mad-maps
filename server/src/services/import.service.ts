import { DOMParser } from '@xmldom/xmldom';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import { geoJsonFeatureCollectionSchema, type Geometry } from '@mapinski/shared';
import type { MapFeatureProperties, Layer } from '../db/schema';
import { getMapForOwner, createMap } from './maps.service';
import { createLayer } from './layers.service';
import { createFeature } from './features.service';
import { sanitizeHtml } from '../lib/sanitizeHtml';

export class ImportValidationError extends Error {}

function fileExtension(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

export function parseImportFile(filename: string, contents: string): GeoJSON.FeatureCollection {
  const ext = fileExtension(filename);
  let raw: unknown;

  if (ext === 'kml') {
    let dom: Document;
    try {
      dom = new DOMParser().parseFromString(contents, 'text/xml') as unknown as Document;
    } catch {
      throw new ImportValidationError('File is not valid KML/XML');
    }
    raw = kmlToGeoJson(dom);
  } else if (ext === 'geojson' || ext === 'json') {
    try {
      raw = JSON.parse(contents);
    } catch {
      throw new ImportValidationError('File is not valid JSON');
    }
  } else {
    throw new ImportValidationError(`Unsupported file extension: .${ext || '(none)'}`);
  }

  const parsed = geoJsonFeatureCollectionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ImportValidationError(
      `File does not contain a valid GeoJSON FeatureCollection: ${parsed.error.issues[0]?.message ?? 'invalid shape'}`,
    );
  }

  return raw as GeoJSON.FeatureCollection;
}

function mapImportedProperties(properties: Record<string, unknown> | null): MapFeatureProperties {
  const rawTitle = properties?.title ?? properties?.name;
  const rawDescription = properties?.descriptionHtml ?? properties?.description;

  return {
    title: typeof rawTitle === 'string' ? rawTitle : '',
    descriptionHtml: sanitizeHtml(typeof rawDescription === 'string' ? rawDescription : ''),
    icon: 'marker',
    color: '#1976d2',
  };
}

export interface ImportResult {
  layerId: string;
  layerName: string;
  featureCount: number;
}

export async function importFeaturesAsNewLayer(
  mapId: string,
  ownerId: string,
  layerName: string,
  featureCollection: GeoJSON.FeatureCollection,
): Promise<ImportResult | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const layer: Layer | null = await createLayer(mapId, ownerId, layerName);
  if (!layer) return null;

  let count = 0;
  for (const feature of featureCollection.features) {
    if (!feature.geometry) continue;
    await createFeature(layer.id, ownerId, {
      geometry: feature.geometry as Geometry,
      properties: mapImportedProperties(feature.properties as Record<string, unknown> | null),
    });
    count++;
  }

  return { layerId: layer.id, layerName: layer.name, featureCount: count };
}

export interface ImportNewMapResult extends ImportResult {
  mapId: string;
}

export async function importFeaturesAsNewMap(
  ownerId: string,
  mapTitle: string,
  layerName: string,
  featureCollection: GeoJSON.FeatureCollection,
): Promise<ImportNewMapResult> {
  const map = await createMap({ ownerId, title: mapTitle });
  const result = await importFeaturesAsNewLayer(map.id, ownerId, layerName, featureCollection);
  return { mapId: map.id, ...result! };
}
