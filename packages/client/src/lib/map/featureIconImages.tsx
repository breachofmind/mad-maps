import { renderToStaticMarkup } from 'react-dom/server';
import type mapboxgl from 'mapbox-gl';
import { FEATURE_ICONS, FEATURE_ICON_NAMES, type FeatureIconName } from '../mapFeatures/icons';
import { getMakiIconMarkup, isMakiIconName } from '../mapFeatures/makiIcons';

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

function normalizeIconName(name: string): string {
  if (isMakiIconName(name)) return name;
  return (FEATURE_ICON_NAMES as readonly string[]).includes(name) ? name : 'marker';
}

export function featureIconImageId(name: string, color: string): string {
  return `${IMAGE_ID_PREFIX}-${normalizeIconName(name)}-${color.replace('#', '')}`;
}

// Pulls the viewBox and inner markup out of an <svg>...</svg> string so
// icons from different sources (MUI's rendered components, vendored Maki
// SVGs) can be re-wrapped identically before rasterizing.
function extractSvgParts(markup: string): { viewBox: string; inner: string } {
  const viewBoxMatch = markup.match(/viewBox="([^"]+)"/);
  const innerMatch = markup.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return { viewBox: viewBoxMatch?.[1] ?? '0 0 24 24', inner: innerMatch?.[1] ?? '' };
}

function rawIconMarkup(name: string): string {
  const makiMarkup = getMakiIconMarkup(name);
  if (makiMarkup) return makiMarkup;
  const Icon = FEATURE_ICONS[name as FeatureIconName] ?? FEATURE_ICONS.marker;
  return renderToStaticMarkup(<Icon />);
}

const STROKE_WIDTH = 2;

// Some glyphs (e.g. Maki's "fuel") sit flush against the edge of their
// source viewBox, leaving no room for the stroke halo below to expand into
// — the SVG viewport clips anything drawn outside it, cutting the halo off
// on that edge. Padding the viewBox by half the stroke width on all sides
// (the max a round linejoin can extend past the path outline) guarantees
// the halo always has room, regardless of how tight the source glyph is.
function padViewBox(viewBox: string, pad: number): string {
  const [minX, minY, width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
  return `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`;
}

function iconDataUrl(name: string, color: string): string {
  // The color is baked directly into the raster (rather than relying on
  // mapbox's SDF icon-color tinting, which requires every resolved image in
  // the layer to be a genuine signed-distance field) so each feature's
  // chosen color renders exactly as picked. A white stroke outline gives
  // the glyph contrast against any basemap without needing a background
  // shape behind it.
  const { viewBox, inner } = extractSvgParts(rawIconMarkup(name));
  const paddedViewBox = padViewBox(viewBox, STROKE_WIDTH / 2);
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${paddedViewBox}" width="24" height="24" fill="${color}" stroke="#ffffff" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" paint-order="stroke fill">${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function rasterizeIcon(name: string, color: string): Promise<ImageData> {
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

function loadIconImage(name: string, color: string): Promise<ImageData> {
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
