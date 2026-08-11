import type { LayerDTO, LayerStyleConfig, PmtilesMetadata } from '@mad-maps/shared';
import { apiClient } from '../apiClient';

export interface UpdateLayerInput {
  name?: string;
  visible?: boolean;
  color?: string;
  defaultIcon?: string;
  styleConfig?: LayerStyleConfig | null;
}

export interface CreateLayerPmtilesOptions {
  sourceFormat: 'pmtiles';
  sourceLayer: string;
  pmtilesMetadata: PmtilesMetadata;
}

export function layersQueryKey(mapId: string) {
  return ['maps', mapId, 'layers'];
}

export async function fetchLayers(mapId: string): Promise<LayerDTO[]> {
  const { data } = await apiClient.get<LayerDTO[]>(`/api/maps/${mapId}/layers`);
  return data;
}

export async function createLayer(
  mapId: string,
  name: string,
  sourceUrl?: string,
  pmtilesOptions?: CreateLayerPmtilesOptions,
): Promise<LayerDTO> {
  const { data } = await apiClient.post<LayerDTO>(`/api/maps/${mapId}/layers`, {
    name,
    sourceUrl,
    ...pmtilesOptions,
  });
  return data;
}

export async function inspectPmtiles(url: string): Promise<PmtilesMetadata> {
  const { data } = await apiClient.post<PmtilesMetadata>('/api/pmtiles/inspect', { url });
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
