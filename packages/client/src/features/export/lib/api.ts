import { apiClient } from '../../../lib/apiClient';

export type ExportFormat = 'geojson' | 'kml';

function filenameFromContentDisposition(header: unknown, fallback: string): string {
  if (typeof header !== 'string') return fallback;
  const match = header.match(/filename="?([^"]+)"?/);
  return match?.[1] ?? fallback;
}

export async function downloadMapExport(mapId: string, format: ExportFormat): Promise<void> {
  const response = await apiClient.get(`/api/maps/${mapId}/export`, {
    params: { format },
    responseType: 'blob',
  });

  const filename = filenameFromContentDisposition(response.headers['content-disposition'], `map.${format}`);

  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
