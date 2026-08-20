import type { PluginSummaryDTO } from '@mad-maps/shared';
import { apiClient } from '../apiClient';

export function pluginsQueryKey() {
  return ['plugins'];
}

export async function fetchPlugins(): Promise<PluginSummaryDTO[]> {
  const { data } = await apiClient.get<PluginSummaryDTO[]>('/api/plugins');
  return data;
}
