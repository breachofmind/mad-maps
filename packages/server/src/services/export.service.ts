import tokml from 'tokml';
import { getMapForOwner } from './maps.service';
import { listLayersForMap } from './layers.service';
import { listFeaturesForLayer, toMapFeatureDTO } from './features.service';
import { DEFAULT_STROKE_WIDTH, geometryStyle } from './kmlStyle';

export function escapeXml(value: string): string {
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
export function extractDocumentInner(kml: string): string {
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

  const styles = new Map<string, string>();
  const folders: string[] = [];

  for (const layer of layers) {
    const layerFeatures = await listFeaturesForLayer(layer.id, ownerId);
    const placemarks: string[] = [];

    for (const row of layerFeatures ?? []) {
      const dto = toMapFeatureDTO(row);
      const singleFeatureKml = tokml(
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: dto.geometry,
              properties: {
                title: dto.properties.title || 'Untitled',
                descriptionHtml: dto.properties.descriptionHtml,
              },
            },
          ],
        },
        { name: 'title', description: 'descriptionHtml' },
      );

      // Calling tokml per-feature (rather than once per layer) keeps this
      // extraction unambiguous: it's either empty (tokml silently skips
      // invalid geometry) or exactly one <Placemark>, so splicing in a
      // <styleUrl> below can't land on the wrong feature.
      let placemark = extractDocumentInner(singleFeatureKml);
      if (!placemark) continue;

      const style = geometryStyle(
        dto.geometry.type,
        dto.properties.color,
        dto.properties.strokeWidth ?? DEFAULT_STROKE_WIDTH,
      );
      if (style) {
        styles.set(style.id, style.block);
        placemark = placemark.replace('<Placemark>', `<Placemark><styleUrl>#${style.id}</styleUrl>`);
      }

      placemarks.push(placemark);
    }

    folders.push(`<Folder><name>${escapeXml(layer.name)}</name>${placemarks.join('')}</Folder>`);
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(map.title)}</name>` +
    `${[...styles.values()].join('')}${folders.join('')}</Document></kml>`
  );
}
