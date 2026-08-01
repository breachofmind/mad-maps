import type { MapFeatureDTO, MapFeaturePropertiesDTO } from '@mapinski/shared';
import { apiClient } from '../apiClient';

export interface CreateFeatureInput {
  geometry: GeoJSON.Geometry;
  properties?: Partial<MapFeaturePropertiesDTO>;
}

export interface UpdateFeatureInput {
  geometry?: GeoJSON.Geometry;
  properties?: Partial<MapFeaturePropertiesDTO>;
}

export function featuresQueryKey(layerId: string) {
  return ['layers', layerId, 'mapFeatures'];
}

export async function fetchFeatures(layerId: string): Promise<MapFeatureDTO[]> {
  const { data } = await apiClient.get<MapFeatureDTO[]>(`/api/layers/${layerId}/mapFeatures`);
  return data;
}

export async function createFeature(layerId: string, input: CreateFeatureInput): Promise<MapFeatureDTO> {
  const { data } = await apiClient.post<MapFeatureDTO>(`/api/layers/${layerId}/mapFeatures`, input);
  return data;
}

export async function updateFeature(featureId: string, input: UpdateFeatureInput): Promise<MapFeatureDTO> {
  const { data } = await apiClient.patch<MapFeatureDTO>(`/api/mapFeatures/${featureId}`, input);
  return data;
}

export async function deleteFeature(featureId: string): Promise<void> {
  await apiClient.delete(`/api/mapFeatures/${featureId}`);
}

export async function moveFeature(featureId: string, layerId: string, index: number): Promise<MapFeatureDTO> {
  const { data } = await apiClient.patch<MapFeatureDTO>(`/api/mapFeatures/${featureId}/move`, { layerId, index });
  return data;
}
