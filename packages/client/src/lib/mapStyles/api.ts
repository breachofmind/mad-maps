import type { BaseStyle, MapStyleDTO } from '@mad-maps/shared';
import { apiClient } from '../apiClient';

export interface CreateMapStyleInput {
  name: string;
  styleUrl: BaseStyle;
}

export interface UpdateMapStyleInput {
  name?: string;
  styleUrl?: BaseStyle;
}

export function mapStylesQueryKey() {
  return ['mapStyles'];
}

export async function fetchMapStyles(): Promise<MapStyleDTO[]> {
  const { data } = await apiClient.get<MapStyleDTO[]>('/api/map-styles');
  return data;
}

export async function createMapStyle(input: CreateMapStyleInput): Promise<MapStyleDTO> {
  const { data } = await apiClient.post<MapStyleDTO>('/api/map-styles', input);
  return data;
}

export async function updateMapStyle(styleId: string, input: UpdateMapStyleInput): Promise<MapStyleDTO> {
  const { data } = await apiClient.patch<MapStyleDTO>(`/api/map-styles/${styleId}`, input);
  return data;
}

export async function deleteMapStyle(styleId: string): Promise<void> {
  await apiClient.delete(`/api/map-styles/${styleId}`);
}
