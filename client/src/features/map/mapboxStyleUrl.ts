const MAPBOX_STYLE_URL_REGEX = /^mapbox:\/\/styles\/[^/]+\/[^/]+$/;

// Accepts mapbox://styles/{username}/{style_id} (e.g. a Mapbox Studio style
// URL), returns the trimmed URL, or null if the input doesn't match.
export function normalizeMapboxStyleUrl(value: string): string | null {
  const trimmed = value.trim();
  return MAPBOX_STYLE_URL_REGEX.test(trimmed) ? trimmed : null;
}
