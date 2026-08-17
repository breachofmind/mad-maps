export type FeatureType = 'point' | 'line' | 'polygon' | 'text';
export type LineStyle = 'solid' | 'dashed' | 'dotted';

export interface UserDTO {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface MapDTO {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  baseStyle: string;
  defaultCenter: { lng: number; lat: number };
  defaultZoom: number;
  createdAt: string;
  updatedAt: string;
}

export type LayerSourceType = 'local' | 'geojson-url' | 'pmtiles-url';

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
  sourceType: LayerSourceType;
  sourceUrl: string | null;
  sourceLayer: string | null;
  pmtilesMetadata: PmtilesMetadata | null;
  styleConfig: LayerStyleConfig | null;
  createdAt: string;
  updatedAt: string;
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
