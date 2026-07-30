export type FeatureType = 'point' | 'line' | 'polygon';

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

export interface LayerDTO {
  id: string;
  mapId: string;
  name: string;
  orderIndex: number;
  visible: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface MapFeaturePropertiesDTO {
  title: string;
  descriptionHtml: string;
  icon: string;
  color: string;
  strokeWidth?: number;
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
}
