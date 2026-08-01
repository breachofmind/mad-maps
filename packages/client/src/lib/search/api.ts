import type { PlaceResultDTO } from '@mapinski/shared';
import { apiClient } from '../apiClient';

export async function searchPlaces(query: string): Promise<PlaceResultDTO[]> {
  const { data } = await apiClient.get<PlaceResultDTO[]>('/api/search', { params: { q: query } });
  return data;
}
