// Local map_features geometry is deliberately narrower than what external
// feeds can contain (see geometrySchema vs externalGeometrySchema in
// packages/shared/src/geojson.ts) — Multi* geometries can't be copied in.
export const COPYABLE_GEOMETRY_TYPES = new Set(['Point', 'LineString', 'Polygon']);

// Local features have no arbitrary property bag (MapFeaturePropertiesDTO is a
// fixed set of fields), so copying a remote feature folds its raw properties
// into the new feature's description instead of silently discarding them.
const MAX_COPIED_PROPERTIES = 20;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCopiedPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

// Builds raw (unsanitized) description HTML from a copied remote feature's
// properties — callers are expected to run this through DOMPurify (see
// SANITIZE_CONFIG) before storing it, same as any other user-facing HTML.
export function buildCopiedDescriptionHtml(properties: GeoJSON.GeoJsonProperties, skipKey: string | null): string {
  const entries = Object.entries(properties ?? {})
    .filter(([key, value]) => key !== skipKey && value !== null && value !== undefined && value !== '')
    .slice(0, MAX_COPIED_PROPERTIES);
  if (entries.length === 0) return '';
  const items = entries
    .map(([key, value]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(formatCopiedPropertyValue(value))}</li>`)
    .join('');
  return `<ul>${items}</ul>`;
}
