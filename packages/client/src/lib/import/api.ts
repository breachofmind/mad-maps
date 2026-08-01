import { apiClient } from '../apiClient';

export interface ImportedLayerResult {
  layerId: string;
  layerName: string;
  featureCount: number;
}

export interface ImportResult {
  layers: ImportedLayerResult[];
  featureCount: number;
}

export interface ImportNewMapResult extends ImportResult {
  mapId: string;
}

export async function importIntoMap(mapId: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ImportResult>(`/api/maps/${mapId}/import`, formData);
  return data;
}

export async function importAsNewMap(file: File): Promise<ImportNewMapResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ImportNewMapResult>('/api/maps/import', formData);
  return data;
}

export function extractImportErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    if (typeof response?.data?.error === 'string') return response.data.error;
  }
  return 'Import failed. Please check the file and try again.';
}
