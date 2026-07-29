import tokml from 'tokml';
import { getMapForOwner } from './maps.service';
import { listLayersForMap } from './layers.service';
import { listFeaturesForLayer, toMapFeatureDTO } from './features.service';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// tokml always wraps its output in <kml><Document>...</Document></kml> with
// no way to ask for just the inner Placemarks, so per-layer KML is generated
// independently and its Document body extracted, then re-wrapped in a
// <Folder> per layer under a single outer <Document>.
function extractDocumentInner(kml: string): string {
  const openTag = '<Document>';
  const start = kml.indexOf(openTag);
  const end = kml.lastIndexOf('</Document>');
  if (start === -1 || end === -1) return '';
  return kml.slice(start + openTag.length, end);
}

export async function buildGeoJsonExport(
  mapId: string,
  ownerId: string,
): Promise<GeoJSON.FeatureCollection | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const layers = await listLayersForMap(mapId, ownerId);
  if (!layers) return null;

  const features: GeoJSON.Feature[] = [];
  for (const layer of layers) {
    const layerFeatures = await listFeaturesForLayer(layer.id, ownerId);
    for (const row of layerFeatures ?? []) {
      const dto = toMapFeatureDTO(row);
      features.push({
        type: 'Feature',
        geometry: dto.geometry,
        properties: {
          title: dto.properties.title,
          descriptionHtml: dto.properties.descriptionHtml,
          icon: dto.properties.icon,
          color: dto.properties.color,
          strokeWidth: dto.properties.strokeWidth,
          layer: layer.name,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

export async function buildKmlExport(mapId: string, ownerId: string): Promise<string | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const layers = await listLayersForMap(mapId, ownerId);
  if (!layers) return null;

  const folders: string[] = [];
  for (const layer of layers) {
    const layerFeatures = await listFeaturesForLayer(layer.id, ownerId);
    const geoJsonFeatures: GeoJSON.Feature[] = (layerFeatures ?? []).map((row) => {
      const dto = toMapFeatureDTO(row);
      return {
        type: 'Feature',
        geometry: dto.geometry,
        properties: {
          title: dto.properties.title || 'Untitled',
          descriptionHtml: dto.properties.descriptionHtml,
        },
      };
    });

    const layerKml = tokml(
      { type: 'FeatureCollection', features: geoJsonFeatures },
      { name: 'title', description: 'descriptionHtml' },
    );

    folders.push(`<Folder><name>${escapeXml(layer.name)}</name>${extractDocumentInner(layerKml)}</Folder>`);
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(map.title)}</name>` +
    `${folders.join('')}</Document></kml>`
  );
}
