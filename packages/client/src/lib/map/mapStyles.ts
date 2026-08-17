import type { BaseStyle } from '@mad-maps/shared';

export interface MapStyleOption {
  id: string;
  label: string;
  style: BaseStyle;
}

// USGS National Map isn't a Mapbox style — it's an Esri ArcGIS MapServer
// raster tile cache. There's no "mapbox://styles/..." URL for it, so instead
// of a style URL this is an inline Mapbox style spec object (raster source +
// a glyphs endpoint so feature-label symbol layers still render). It's sent
// and stored as-is (see BaseStyle in @mad-maps/shared) — mapboxgl.Map's
// `style` option accepts either a URL string or a style object directly.
const USGS_TOPO_STYLE: BaseStyle = {
  version: 8,
  sources: {
    'usgs-topo': {
      type: 'raster',
      tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 16,
      attribution: 'USGS The National Map',
    },
  },
  layers: [{ id: 'usgs-topo', type: 'raster', source: 'usgs-topo' }],
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
};

export const MAP_STYLE_OPTIONS: MapStyleOption[] = [
  { id: 'streets', label: 'Streets', style: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'satellite', label: 'Satellite', style: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { id: 'outdoors', label: 'Terrain', style: 'mapbox://styles/mapbox/outdoors-v12' },
  { id: 'dark', label: 'Dark', style: 'mapbox://styles/mapbox/dark-v11' },
  { id: 'usgs-topo', label: 'USGS Topo', style: USGS_TOPO_STYLE },
];

export const DEFAULT_MAP_STYLE = MAP_STYLE_OPTIONS[0];

// A stable identity for a BaseStyle value, safe to compare with ===. Object
// key order isn't semantically meaningful, but plain JSON.stringify is
// order-sensitive — and Postgres's jsonb column reorders keys alphabetically
// on write, so a style round-tripped through the API would otherwise never
// match the client's own literal (e.g. USGS_TOPO_STYLE above). Sorting keys
// recursively before stringifying makes the comparison content-based.
export function baseStyleKey(style: BaseStyle): string {
  return typeof style === 'string' ? style : JSON.stringify(canonicalize(style));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}
