import type { LayerDTO } from '@mapinski/shared';
import { apiClient } from '../../lib/apiClient';

export interface UpdateLayerInput {
  name?: string;
  visible?: boolean;
  color?: string;
}

export function layersQueryKey(mapId: string) {
  return ['maps', mapId, 'layers'];
}

export async function fetchLayers(mapId: string): Promise<LayerDTO[]> {
  const { data } = await apiClient.get<LayerDTO[]>(`/api/maps/${mapId}/layers`);
  return data;
}

export async function createLayer(mapId: string, name: string, sourceUrl?: string): Promise<LayerDTO> {
  const { data } = await apiClient.post<LayerDTO>(`/api/maps/${mapId}/layers`, { name, sourceUrl });
  return data;
}

export function externalLayerDataQueryKey(layerId: string) {
  return ['layers', layerId, 'external-data'];
}

export async function fetchExternalLayerData(
  layerId: string,
  options?: { force?: boolean },
): Promise<GeoJSON.FeatureCollection> {
  const { data } = await apiClient.get<GeoJSON.FeatureCollection>(`/api/layers/${layerId}/external-data`, {
    params: options?.force ? { refresh: 'true' } : undefined,
  });
  return data;
}

export async function updateLayer(layerId: string, input: UpdateLayerInput): Promise<LayerDTO> {
  const { data } = await apiClient.patch<LayerDTO>(`/api/layers/${layerId}`, input);
  return data;
}

export async function deleteLayer(layerId: string): Promise<void> {
  await apiClient.delete(`/api/layers/${layerId}`);
}

export async function reorderLayers(mapId: string, layerIds: string[]): Promise<LayerDTO[]> {
  const { data } = await apiClient.patch<LayerDTO[]>(`/api/maps/${mapId}/layers/reorder`, {
    layerIds,
  });
  return data;
}
