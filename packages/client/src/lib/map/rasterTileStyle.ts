import type { BaseStyle } from '@mad-maps/shared';

// Builds an inline Mapbox style spec (see BaseStyle in @mad-maps/shared)
// wrapping a single raster tile source — the same shape used for the
// built-in USGS Topo basemap in lib/map/mapStyles.ts, but parameterized so
// the "Add Style" dialog (MapStylesPage.tsx) can build one from just a tile
// URL template, for basemaps with no Mapbox style behind them (USGS
// Imagery, other XYZ/TMS raster tile services, etc).
//
// maxzoom matters more than it looks: a cached tile service (ArcGIS
// MapServer, TileServer GL, etc) only has tiles up to some zoom level —
// often *unevenly*, e.g. USGS Imagery Only's cache goes to z23 but only in
// areas with high-resolution source photography, so requests for missing
// z/x/y combinations 404. Setting maxzoom tells Mapbox GL to stop
// requesting tiles past that level and instead stretch the last one it has
// — no more 404s, just blurrier tiles once you zoom past real coverage.
export function buildRasterTileStyle(tileUrl: string, attribution?: string, maxzoom?: number): BaseStyle | null {
  const trimmed = tileUrl.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('{z}') || !trimmed.includes('{x}') || !trimmed.includes('{y}')) return null;

  return {
    version: 8,
    sources: {
      raster: {
        type: 'raster',
        tiles: [trimmed],
        tileSize: 256,
        ...(maxzoom !== undefined ? { maxzoom } : {}),
        ...(attribution?.trim() ? { attribution: attribution.trim() } : {}),
      },
    },
    layers: [{ id: 'raster', type: 'raster', source: 'raster' }],
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  };
}
