import type mapboxgl from 'mapbox-gl';

// WCAG relative luminance (0 = black, 1 = white).
export function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

const LIGHT_BASEMAP_HIGHLIGHT = '#1a1a1a';
export const DEFAULT_HIGHLIGHT_COLOR = '#ffffff';
const LUMINANCE_THRESHOLD = 0.5;

export function highlightColorForLuminance(luminance: number): string {
  return luminance > LUMINANCE_THRESHOLD ? LIGHT_BASEMAP_HIGHLIGHT : DEFAULT_HIGHLIGHT_COLOR;
}

export interface LabelColors {
  text: string;
  halo: string;
}

// Default (assumed-light-basemap) label colors, used until a real sample
// is available.
export const DEFAULT_LABEL_COLORS: LabelColors = {
  text: LIGHT_BASEMAP_HIGHLIGHT,
  halo: 'rgba(255, 255, 255, 0.75)',
};
const DARK_BASEMAP_LABEL_COLORS: LabelColors = { text: DEFAULT_HIGHLIGHT_COLOR, halo: 'rgba(0, 0, 0, 0.75)' };

// Derives a text/halo pair from sampleBasemapHighlightColor's result: white
// text on a dark halo when that reads as a dark basemap (its result equals
// DEFAULT_HIGHLIGHT_COLOR), otherwise dark text on a light halo — so a
// map label's halo is always the *opposite* tone of its text, rather than
// a fixed dark-text-on-white-halo scheme that disappears on dark basemaps.
export function labelColorsForHighlight(highlightColor: string): LabelColors {
  return highlightColor === DEFAULT_HIGHLIGHT_COLOR ? DARK_BASEMAP_LABEL_COLORS : DEFAULT_LABEL_COLORS;
}

// Small enough to be cheap, large enough to average out individual map
// labels/roads rather than landing on one.
const SAMPLE_GRID_SIZE = 8;

// Reads back the map's actual rendered pixels (so it works for any basemap,
// including satellite imagery and custom Mapbox Studio styles with no single
// "background color") and picks whichever highlight reads as legible against
// it. Requires the map to have been created with `preserveDrawingBuffer:
// true` — otherwise the browser is free to clear the WebGL buffer before
// this can read it back, and every sample reads as blank.
export function sampleBasemapHighlightColor(map: mapboxgl.Map): string {
  const luminance = sampleCanvasLuminance(map.getCanvas());
  return luminance === null ? DEFAULT_HIGHLIGHT_COLOR : highlightColorForLuminance(luminance);
}

function sampleCanvasLuminance(source: HTMLCanvasElement): number | null {
  const { width, height } = source;
  if (width === 0 || height === 0) return null;

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = SAMPLE_GRID_SIZE;
  sampleCanvas.height = SAMPLE_GRID_SIZE;
  const ctx = sampleCanvas.getContext('2d');
  if (!ctx) return null;

  try {
    // Downscaling the whole frame onto a tiny canvas lets the browser's own
    // image resampling do the averaging, instead of manually walking a grid
    // of getImageData reads across the full-resolution source.
    ctx.drawImage(source, 0, 0, width, height, 0, 0, SAMPLE_GRID_SIZE, SAMPLE_GRID_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_GRID_SIZE, SAMPLE_GRID_SIZE);
    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // fully transparent sample, e.g. an unrendered edge
      total += relativeLuminance(data[i], data[i + 1], data[i + 2]);
      count += 1;
    }
    return count === 0 ? null : total / count;
  } catch {
    // getImageData throws on a tainted canvas (cross-origin tiles served
    // without CORS headers) — fall back to the default rather than
    // breaking the hover/selection highlight entirely.
    return null;
  }
}
