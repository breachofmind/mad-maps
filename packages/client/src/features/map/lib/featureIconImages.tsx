import { renderToStaticMarkup } from 'react-dom/server';
import type mapboxgl from 'mapbox-gl';
import { FEATURE_ICONS, FEATURE_ICON_NAMES, type FeatureIconName } from '../../mapFeatures/lib/icons';

// Raster resolution the icons are rendered at; mapbox re-scales them per
// feature at render time via the layer's icon-size, so this just needs to
// be sharp enough to downscale cleanly.
const ICON_RASTER_SIZE = 64;

// Namespaced so a runtime-registered icon can never collide with an image
// already baked into the base map style's own sprite sheet — Mapbox's
// streets style ships icons literally named "marker", "restaurant", "cafe",
// and "parking", which is exactly the set this app's icon picker also
// uses. An unprefixed id would silently resolve to Mapbox's own (non-SDF,
// wrong-sized, uncolored) sprite instead of ours.
const IMAGE_ID_PREFIX = 'mapinski-icon';

function normalizeIconName(name: string): FeatureIconName {
  return (FEATURE_ICON_NAMES as readonly string[]).includes(name) ? (name as FeatureIconName) : 'marker';
}

export function featureIconImageId(name: string, color: string): string {
  return `${IMAGE_ID_PREFIX}-${normalizeIconName(name)}-${color.replace('#', '')}`;
}

function iconDataUrl(name: FeatureIconName, color: string): string {
  const Icon = FEATURE_ICONS[name];
  // The color is baked directly into the raster (rather than relying on
  // mapbox's SDF icon-color tinting, which requires every resolved image in
  // the layer to be a genuine signed-distance field) so each feature's
  // chosen color renders exactly as picked. A white stroke outline gives
  // the glyph contrast against any basemap without needing a background
  // shape behind it.
  const markup = renderToStaticMarkup(<Icon />).replace(
    '<svg ',
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" paint-order="stroke fill" `,
  );
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function rasterizeIcon(name: FeatureIconName, color: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = ICON_RASTER_SIZE;
      canvas.height = ICON_RASTER_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, ICON_RASTER_SIZE, ICON_RASTER_SIZE);
      resolve(ctx.getImageData(0, 0, ICON_RASTER_SIZE, ICON_RASTER_SIZE));
    };
    img.onerror = () => reject(new Error(`Failed to rasterize icon "${name}" (${color})`));
    img.src = iconDataUrl(name, color);
  });
}

const rasterCache = new Map<string, Promise<ImageData>>();

function loadIconImage(name: FeatureIconName, color: string): Promise<ImageData> {
  const key = `${name}:${color}`;
  let cached = rasterCache.get(key);
  if (!cached) {
    cached = rasterizeIcon(name, color);
    rasterCache.set(key, cached);
  }
  return cached;
}

export interface FeatureIconRef {
  icon: string;
  color: string;
}

// Registers (and caches, per icon/color pair) whatever images the given
// features need. Images are per-style — mapbox drops runtime images on
// style changes — so this re-adds any missing ones against the map's
// current style each time it's called.
export async function ensureFeatureIconImages(map: mapboxgl.Map, refs: Iterable<FeatureIconRef>): Promise<void> {
  const pending: Promise<void>[] = [];
  const seen = new Set<string>();
  for (const { icon, color } of refs) {
    const name = normalizeIconName(icon);
    const id = featureIconImageId(name, color);
    if (seen.has(id) || map.hasImage(id)) continue;
    seen.add(id);
    pending.push(
      loadIconImage(name, color).then((imageData) => {
        if (!map.hasImage(id)) map.addImage(id, imageData);
      }),
    );
  }
  await Promise.all(pending);
}
