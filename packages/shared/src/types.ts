export type FeatureType = 'point' | 'line' | 'polygon' | 'text';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

// Most base styles are a "mapbox://styles/{user}/{id}" URL, but a basemap
// with no Mapbox style behind it (e.g. a raw raster tile service like USGS
// Topo) is stored as an inline Mapbox style spec object instead. Kept loose
// (not the full Mapbox GL StyleSpecification) since this package has no
// mapbox-gl dependency and only needs to validate/pass it through, not
// interpret it.
export interface InlineMapStyle {
  version: number;
  sources: Record<string, unknown>;
  layers: unknown[];
  [key: string]: unknown;
}

export type BaseStyle = string | InlineMapStyle;

export interface MapDTO {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  baseStyle: BaseStyle;
  defaultCenter: { lng: number; lat: number };
  defaultZoom: number;
  createdAt: string;
  updatedAt: string;
}

export interface MapStyleDTO {
  id: string;
  ownerId: string;
  name: string;
  styleUrl: BaseStyle;
  createdAt: string;
  updatedAt: string;
}

export type LayerSourceType = 'local' | 'geojson-url' | 'pmtiles-url' | 'raster-url';

export interface PmtilesLayerMeta {
  id: string;
  fields: Record<string, 'Number' | 'String' | 'Boolean'>;
  description?: string;
  minzoom?: number;
  maxzoom?: number;
}

export interface PmtilesMetadata {
  layers: PmtilesLayerMeta[];
  minzoom: number;
  maxzoom: number;
  bounds?: [number, number, number, number];
}

export interface LayerColorStop {
  value: number;
  color: string;
}

export interface LayerIconRule {
  value: string;
  // Either an image URL or a namespaced Maki icon name (see
  // makiIcons.ts's isMakiIconName) — same "maki:"-prefix convention used by
  // MapFeaturePropertiesDTO.icon/LayerDTO.defaultIcon below.
  iconUrl: string;
}

export interface LayerStyleConfig {
  labelProperty: string | null;
  colorProperty: string | null;
  colorStops: LayerColorStop[];
  iconProperty: string | null;
  // Icon-by-value rules, keyed by property name — a layer remembers each
  // property's rules even while only `iconProperty` is the active one, so
  // switching iconProperty back to a previously-configured property
  // restores its rules instead of discarding them.
  iconRulesByProperty: Record<string, LayerIconRule[]>;
  // Fallback icon (image URL or "maki:"-prefixed icon name, see
  // LayerIconRule.iconUrl) for points that don't match any iconRule, or when
  // iconProperty isn't set at all — the "default pin" for this remote layer.
  // Falls back to the plain circle marker when null.
  defaultIconUrl: string | null;
}

export interface LayerDTO {
  id: string;
  mapId: string;
  name: string;
  orderIndex: number;
  visible: boolean;
  color: string;
  // Icon (from lib/mapFeatures/icons.ts's built-in set) applied to brand-new
  // local features added to this layer — only meaningful for sourceType
  // 'local'; remote layers use styleConfig.defaultIconUrl instead.
  defaultIcon: string;
  // 0-1. Currently only surfaced in the UI/renderer for sourceType
  // 'raster-url' — see LayerPropertiesPanel and ensureRemoteLayer.ts.
  opacity: number;
  sourceType: LayerSourceType;
  sourceUrl: string | null;
  sourceLayer: string | null;
  pmtilesMetadata: PmtilesMetadata | null;
  styleConfig: LayerStyleConfig | null;
  // Only meaningful for sourceType 'local' — a URL Mad Maps POSTs feature
  // details to on selection, rendering the JSON blocks it returns in the
  // feature properties panel. See @mad-maps/shared's pluginPanel.ts for the
  // request/response contract. Mutually exclusive with pluginId.
  pluginEndpointUrl: string | null;
  // Only meaningful for sourceType 'local' — id of a server-loaded local
  // plugin (see packages/server/src/plugins/pluginRegistry.ts) to call
  // instead of an external URL. Mutually exclusive with pluginEndpointUrl.
  pluginId: string | null;
  createdAt: string;
  updatedAt: string;
}

// A locally-loaded plugin's public summary, as returned by GET /api/plugins.
export interface PluginSummaryDTO {
  id: string;
  name: string;
  description: string;
}

export interface MapFeaturePropertiesDTO {
  title: string;
  descriptionHtml: string;
  icon: string;
  color: string;
  strokeWidth?: number;
  lineStyle?: LineStyle;
  fontSize?: number;
}

export interface MapFeatureDTO {
  id: string;
  layerId: string;
  orderIndex: number;
  featureType: FeatureType;
  geometry: GeoJSON.Geometry;
  properties: MapFeaturePropertiesDTO;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceResultDTO {
  placeId: string;
  name: string;
  formattedAddress: string;
  lng: number;
  lat: number;
  googleMapsUri: string | null;
  rating: number | null;
  userRatingCount: number | null;
}
