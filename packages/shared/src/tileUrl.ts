// Shared by the raster basemap style flow (client's rasterTileStyle.ts) and
// the raster-url external layer flow (createLayerSchema) — both need to
// confirm a URL is a genuine {z}/{x}/{y} tile template before treating it as
// one, rather than duplicating the same three .includes() checks.
export function isXyzTileUrlTemplate(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.includes('{z}') && trimmed.includes('{x}') && trimmed.includes('{y}');
}
