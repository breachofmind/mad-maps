import type mapboxgl from 'mapbox-gl';

// Source images arrive at whatever resolution the external host serves —
// normalizing to a fixed square (preserving aspect ratio, not stretching)
// lets every rule use the same 'icon-size' regardless of source dimensions.
const ICON_RASTER_SIZE = 48;
const IMAGE_ID_PREFIX = 'mapinski-ext-icon';

// FNV-1a: cheap, deterministic, good enough to key a Mapbox image id off an
// arbitrary URL without leaking the raw (potentially very long) URL into it.
function hashUrl(url: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function externalIconImageId(url: string): string {
  return `${IMAGE_ID_PREFIX}-${hashUrl(url)}`;
}

function loadExternalIconImage(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Without this, a cross-origin load either fails outright on hosts that
    // don't answer CORS preflight, or "succeeds" into a canvas-tainted image
    // that throws on getImageData below — setting it up front makes hosts
    // without CORS support fail cleanly via onerror instead.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = ICON_RASTER_SIZE;
        canvas.height = ICON_RASTER_SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        // An SVG with only a viewBox (no width/height attributes) reports
        // naturalWidth/naturalHeight as 0 per the HTML spec's intrinsic-size
        // rules, even though it renders fine — falling back to a full,
        // unscaled square avoids a 0-division producing a NaN/Infinite
        // drawImage size (which throws) for that common case.
        const naturalWidth = img.naturalWidth || ICON_RASTER_SIZE;
        const naturalHeight = img.naturalHeight || ICON_RASTER_SIZE;
        const scale = Math.min(ICON_RASTER_SIZE / naturalWidth, ICON_RASTER_SIZE / naturalHeight);
        const w = naturalWidth * scale;
        const h = naturalHeight * scale;
        ctx.drawImage(img, (ICON_RASTER_SIZE - w) / 2, (ICON_RASTER_SIZE - h) / 2, w, h);
        resolve(ctx.getImageData(0, 0, ICON_RASTER_SIZE, ICON_RASTER_SIZE));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load icon image: ${url}`));
    img.src = url;
  });
}

const imageCache = new Map<string, Promise<ImageData>>();

function loadCached(url: string): Promise<ImageData> {
  let cached = imageCache.get(url);
  if (!cached) {
    cached = loadExternalIconImage(url);
    imageCache.set(url, cached);
    // Don't let a failed load stay cached forever — if the user fixes a
    // typo'd URL or the host later adds CORS support, the next sync should
    // retry rather than staying broken for the rest of the session.
    cached.catch(() => imageCache.delete(url));
  }
  return cached;
}

// For the layer-properties preview thumbnail. Reuses loadCached rather than
// a plain `<img src=url>` so there's only ever one network fetch per url —
// two independent DOM image loads of the same cross-origin url (one for a
// preview, one via `new Image()` here) can otherwise race and conflict in
// the browser's image cache even with matching crossOrigin attributes,
// producing a spurious CORS failure on one of them.
export async function previewIconImage(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const imageData = await loadCached(url);
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
  } catch {
    return null;
  }
}

export interface ExternalIconLoadResult {
  loaded: Set<string>;
  failed: Set<string>;
}

// Registers (and caches) whatever external icon images the given urls need,
// mirroring featureIconImages.tsx's ensureFeatureIconImages but for
// user-supplied external images rather than the app's bundled icon set.
// Images are per-style — mapbox drops runtime images on style changes — so
// this re-adds any missing ones against the map's current style each call.
export async function ensureExternalIconImages(
  map: mapboxgl.Map,
  urls: Iterable<string>,
): Promise<ExternalIconLoadResult> {
  const loaded = new Set<string>();
  const failed = new Set<string>();
  const pending: Promise<void>[] = [];

  for (const url of new Set(urls)) {
    if (!url) continue;
    const id = externalIconImageId(url);
    if (map.hasImage(id)) {
      loaded.add(url);
      continue;
    }
    pending.push(
      loadCached(url)
        .then((imageData) => {
          if (!map.hasImage(id)) map.addImage(id, imageData);
          loaded.add(url);
        })
        .catch(() => {
          failed.add(url);
        }),
    );
  }

  await Promise.all(pending);
  return { loaded, failed };
}
