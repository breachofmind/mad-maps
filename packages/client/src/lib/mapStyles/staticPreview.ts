import type { BaseStyle } from '@mad-maps/shared';

const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const MAPBOX_STYLE_URL_MATCH = /^mapbox:\/\/styles\/([^/]+)\/([^/]+)$/;

// A fixed, generic view (roughly centered on the continental US) — this is a
// style preview, not a rendering of any particular map's own center/zoom.
const PREVIEW_LNG = -98.5795;
const PREVIEW_LAT = 39.8283;
const PREVIEW_ZOOM = 2.5;

// The Mapbox Static Images API only has previews for Mapbox Studio styles —
// an inline style spec (e.g. the USGS Topo raster basemap) has no such
// preview, so this just falls back to a blank card background.
export function staticPreviewUrl(style: BaseStyle, options?: { width?: number; height?: number }): string | null {
  if (typeof style !== 'string') return null;
  const match = MAPBOX_STYLE_URL_MATCH.exec(style);
  if (!match) return null;
  const [, username, styleId] = match;
  const width = options?.width ?? 320;
  const height = options?.height ?? 180;
  return `https://api.mapbox.com/styles/v1/${username}/${styleId}/static/${PREVIEW_LNG},${PREVIEW_LAT},${PREVIEW_ZOOM},0/${width}x${height}?access_token=${accessToken}`;
}
