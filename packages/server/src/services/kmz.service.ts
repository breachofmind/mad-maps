import sharp from 'sharp';
import JSZip from 'jszip';
import tokml from 'tokml';
import { getMakiIconMarkup, isMakiIconName } from '@mad-maps/shared';
import { getMapForOwner } from './maps.service';
import { listLayersForMap } from './layers.service';
import { listFeaturesForLayer, toMapFeatureDTO } from './features.service';
import { escapeXml, extractDocumentInner } from './export.service';
import { DEFAULT_STROKE_WIDTH, geometryStyle } from './kmlStyle';

// Matches the client's raster size for feature icons
// (packages/client/src/lib/map/featureIconImages.tsx's ICON_RASTER_SIZE).
const ICON_RASTER_SIZE = 64;

// Legacy features may still carry a pre-Maki MUI icon key (e.g. "restaurant")
// — that rendering pipeline is React/browser-only, so rather than porting it
// to the server, KMZ falls back to a plain colored marker for anything that
// isn't a recognized Maki key.
const DEFAULT_ICON = 'maki:marker';

function resolveIconKey(icon: string): string {
  return isMakiIconName(icon) ? icon : DEFAULT_ICON;
}

function iconStyleId(icon: string, color: string): string {
  return `icon-${icon.replace(/[^a-zA-Z0-9]/g, '-')}-${color.replace('#', '')}`;
}

// Maki paths have no explicit fill, so injecting it on the root <svg> lets
// it inherit down — same technique as featureIconImages.tsx's iconDataUrl.
function coloredIconSvg(icon: string, color: string): string {
  const markup = getMakiIconMarkup(icon) ?? getMakiIconMarkup(DEFAULT_ICON)!;
  return markup.replace('<svg ', `<svg fill="${color}" `);
}

export async function buildKmzExport(mapId: string, ownerId: string): Promise<Buffer | null> {
  const map = await getMapForOwner(mapId, ownerId);
  if (!map) return null;

  const layers = await listLayersForMap(mapId, ownerId);
  if (!layers) return null;

  const styles = new Map<string, string>();
  const folders: string[] = [];
  const iconPngs = new Map<string, Promise<Buffer>>();

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

      if (dto.geometry.type === 'Point') {
        const resolvedIcon = resolveIconKey(dto.properties.icon);
        const id = iconStyleId(resolvedIcon, dto.properties.color);
        if (!iconPngs.has(id)) {
          const svg = coloredIconSvg(resolvedIcon, dto.properties.color);
          iconPngs.set(id, sharp(Buffer.from(svg)).resize(ICON_RASTER_SIZE, ICON_RASTER_SIZE).png().toBuffer());
          styles.set(id, `<Style id="${id}"><IconStyle><Icon><href>icons/${id}.png</href></Icon></IconStyle></Style>`);
        }
        placemark = placemark.replace('<Placemark>', `<Placemark><styleUrl>#${id}</styleUrl>`);
      } else {
        const style = geometryStyle(
          dto.geometry.type,
          dto.properties.color,
          dto.properties.strokeWidth ?? DEFAULT_STROKE_WIDTH,
        );
        if (style) {
          styles.set(style.id, style.block);
          placemark = placemark.replace('<Placemark>', `<Placemark><styleUrl>#${style.id}</styleUrl>`);
        }
      }

      placemarks.push(placemark);
    }

    folders.push(`<Folder><name>${escapeXml(layer.name)}</name>${placemarks.join('')}</Folder>`);
  }

  const kml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(map.title)}</name>` +
    `${[...styles.values()].join('')}${folders.join('')}</Document></kml>`;

  const zip = new JSZip();
  zip.file('doc.kml', kml);
  const iconFolder = zip.folder('icons')!;
  for (const [id, pngPromise] of iconPngs) {
    iconFolder.file(`${id}.png`, await pngPromise);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
