import { DOMParser } from '@xmldom/xmldom';
import { kmlWithFolders, type Folder, type F as KmlFeature } from '@tmcw/togeojson';
import { geoJsonFeatureCollectionSchema, geometryToFeatureType, type Geometry } from '@mapinski/shared';
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

// Our geometry column is 2D-only (see schema.ts), but KML/GeoJSON sources
// (e.g. exports from mapping apps that record altitude) commonly include a Z
// coordinate. Drop it here so PostGIS doesn't reject the insert with
// "Geometry has Z dimension but column does not".
function stripZCoordinates(coords: unknown): unknown {
  if (Array.isArray(coords)) {
    if (typeof coords[0] === 'number') return coords.slice(0, 2);
    return coords.map(stripZCoordinates);
  }
  return coords;
}

function stripZFromFeatureCollection(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { features?: unknown }).features)) {
    return raw;
  }
  const collection = raw as { features: unknown[] };
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (!feature || typeof feature !== 'object') return feature;
      const { geometry } = feature as { geometry?: { coordinates?: unknown } };
      if (!geometry || typeof geometry !== 'object' || !('coordinates' in geometry)) return feature;
      return {
        ...feature,
        geometry: { ...geometry, coordinates: stripZCoordinates(geometry.coordinates) },
      };
    }),
  };
}

interface RawImportGroup {
  name: string | null;
  raw: unknown;
}

function isFolderNode(node: Folder | KmlFeature): node is Folder {
  return node.type === 'folder';
}

function collectLeafFeatures(nodes: Array<Folder | KmlFeature>, out: unknown[]): void {
  for (const node of nodes) {
    // Our layer model is flat, so a subfolder's features roll up into
    // whichever top-level folder (i.e. layer) contains it.
    if (isFolderNode(node)) collectLeafFeatures(node.children, out);
    else out.push(node);
  }
}

// KML "layers" (as authored in Google My Maps / Google Earth) are Folder
// elements. Map each top-level Folder to its own group so it can become its
// own layer on import; Placemarks sitting directly under the root (not in
// any Folder) fall back to a single ungrouped bucket.
function kmlToRawGroups(dom: Document): RawImportGroup[] {
  const tree = kmlWithFolders(dom);
  const groups: RawImportGroup[] = [];
  const ungrouped: unknown[] = [];

  for (const node of tree.children) {
    if (isFolderNode(node)) {
      const features: unknown[] = [];
      collectLeafFeatures(node.children, features);
      const name = typeof node.meta.name === 'string' ? node.meta.name : null;
      groups.push({ name, raw: { type: 'FeatureCollection', features } });
    } else {
      ungrouped.push(node);
    }
  }

  if (ungrouped.length > 0 || groups.length === 0) {
    groups.push({ name: null, raw: { type: 'FeatureCollection', features: ungrouped } });
  }

  return groups;
}

export interface ImportGroup {
  // null means "no source grouping" - the caller's own default layer name is used.
  name: string | null;
  featureCollection: GeoJSON.FeatureCollection;
}

export function parseImportFileGroups(filename: string, contents: string): ImportGroup[] {
  const ext = fileExtension(filename);
  let rawGroups: RawImportGroup[];

  if (ext === 'kml') {
    let dom: Document;
    try {
      dom = new DOMParser().parseFromString(contents, 'text/xml') as unknown as Document;
    } catch {
      throw new ImportValidationError('File is not valid KML/XML');
    }
    rawGroups = kmlToRawGroups(dom);
  } else if (ext === 'geojson' || ext === 'json') {
    let raw: unknown;
    try {
      raw = JSON.parse(contents);
    } catch {
      throw new ImportValidationError('File is not valid JSON');
    }
    rawGroups = [{ name: null, raw }];
  } else {
    throw new ImportValidationError(`Unsupported file extension: .${ext || '(none)'}`);
  }

  return rawGroups.map(({ name, raw }) => {
    const stripped = stripZFromFeatureCollection(raw);
    const parsed = geoJsonFeatureCollectionSchema.safeParse(stripped);
    if (!parsed.success) {
      throw new ImportValidationError(
        `File does not contain a valid GeoJSON FeatureCollection: ${parsed.error.issues[0]?.message ?? 'invalid shape'}`,
      );
    }
    return { name, featureCollection: stripped as GeoJSON.FeatureCollection };
  });
}

export function parseImportFile(filename: string, contents: string): GeoJSON.FeatureCollection {
  const groups = parseImportFileGroups(filename, contents);
  return {
    type: 'FeatureCollection',
    features: groups.flatMap((group) => group.featureCollection.features),
  };
}

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function firstValidHexColor(...candidates: unknown[]): string | undefined {
  return candidates.find((c): c is string => typeof c === 'string' && HEX_COLOR_RE.test(c));
}

// KML styles (surfaced by togeojson) and the GeoJSON simplestyle-spec both
// carry a per-feature color, but under different keys depending on geometry
// type: markers use marker-color/icon-color, lines/polygon outlines use
// stroke, and polygon fills use fill.
function colorFromImportedProperties(
  properties: Record<string, unknown> | null,
  featureType: 'point' | 'line' | 'polygon',
): string | undefined {
  if (!properties) return undefined;
  switch (featureType) {
    case 'point':
      return firstValidHexColor(properties['marker-color'], properties['icon-color']);
    case 'polygon':
      return firstValidHexColor(properties['fill'], properties['stroke']);
    case 'line':
      return firstValidHexColor(properties['stroke']);
  }
}

function mapImportedProperties(
  properties: Record<string, unknown> | null,
  featureType: 'point' | 'line' | 'polygon',
): MapFeatureProperties {
  const rawTitle = properties?.title ?? properties?.name;
  const rawDescription = properties?.descriptionHtml ?? properties?.description;

  return {
    title: typeof rawTitle === 'string' ? rawTitle : '',
    descriptionHtml: sanitizeHtml(typeof rawDescription === 'string' ? rawDescription : ''),
    icon: 'marker',
    color: colorFromImportedProperties(properties, featureType) ?? '#1976d2',
  };
}

export interface ImportedLayerResult {
  layerId: string;
  layerName: string;
  featureCount: number;
}

export interface ImportResult {
  layers: ImportedLayerResult[];
  featureCount: number;
}

export async function importFeaturesAsNewLayer(
  mapId: string,
  ownerId: string,
  defaultLayerName: string,
  groups: ImportGroup[],
): Promise<ImportResult | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const layerResults: ImportedLayerResult[] = [];
  for (const group of groups) {
    // Skip folders that contributed no features, but always create the
    // ungrouped bucket (name === null) so a plain/flat import still yields
    // exactly one layer, even an empty one.
    if (group.name !== null && group.featureCollection.features.length === 0) continue;

    const layer: Layer | null = await createLayer(mapId, ownerId, group.name ?? defaultLayerName);
    if (!layer) return null;

    let count = 0;
    for (const feature of group.featureCollection.features) {
      if (!feature.geometry) continue;
      const geometry = feature.geometry as Geometry;
      await createFeature(layer.id, ownerId, {
        geometry,
        properties: mapImportedProperties(
          feature.properties as Record<string, unknown> | null,
          geometryToFeatureType(geometry),
        ),
      });
      count++;
    }
    layerResults.push({ layerId: layer.id, layerName: layer.name, featureCount: count });
  }

  return {
    layers: layerResults,
    featureCount: layerResults.reduce((sum, result) => sum + result.featureCount, 0),
  };
}

export interface ImportNewMapResult extends ImportResult {
  mapId: string;
}

export async function importFeaturesAsNewMap(
  ownerId: string,
  mapTitle: string,
  layerName: string,
  groups: ImportGroup[],
): Promise<ImportNewMapResult> {
  const map = await createMap({ ownerId, title: mapTitle });
  const result = await importFeaturesAsNewLayer(map.id, ownerId, layerName, groups);
  return { mapId: map.id, ...result! };
}
