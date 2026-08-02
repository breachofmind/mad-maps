export type FeatureType = 'point' | 'line' | 'polygon';
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
  iconUrl: string;
}

export interface LayerStyleConfig {
  labelProperty: string | null;
  colorProperty: string | null;
  colorStops: LayerColorStop[];
  iconProperty: string | null;
  iconRules: LayerIconRule[];
}

export interface LayerDTO {
  id: string;
  mapId: string;
  name: string;
  orderIndex: number;
  visible: boolean;
  color: string;
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
