import type { BaseStyle, MapDTO } from '@mad-maps/shared';
import { apiClient } from '../apiClient';

export interface CreateMapInput {
  title: string;
  description?: string;
}

export interface UpdateMapInput {
  title?: string;
  description?: string | null;
  baseStyle?: BaseStyle;
  defaultCenter?: { lng: number; lat: number };
  defaultZoom?: number;
}

export async function fetchMaps(): Promise<MapDTO[]> {
  const { data } = await apiClient.get<MapDTO[]>('/api/maps');
  return data;
}

export async function fetchMap(mapId: string): Promise<MapDTO> {
  const { data } = await apiClient.get<MapDTO>(`/api/maps/${mapId}`);
  return data;
}

export async function createMap(input: CreateMapInput): Promise<MapDTO> {
  const { data } = await apiClient.post<MapDTO>('/api/maps', input);
  return data;
}

export async function updateMap(mapId: string, input: UpdateMapInput): Promise<MapDTO> {
  const { data } = await apiClient.patch<MapDTO>(`/api/maps/${mapId}`, input);
  return data;
}

export async function deleteMap(mapId: string): Promise<void> {
  await apiClient.delete(`/api/maps/${mapId}`);
}
