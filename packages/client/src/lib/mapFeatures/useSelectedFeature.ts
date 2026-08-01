import { useQueries } from '@tanstack/react-query';
import type { LayerDTO, MapFeatureDTO } from '@mapinski/shared';
import { useEditorStore } from '../state/editorStore';
import { featuresQueryKey, fetchFeatures } from './api';

export interface SelectedFeature {
  feature: MapFeatureDTO;
  layer: LayerDTO;
}

export function useSelectedFeature(layers: LayerDTO[]): SelectedFeature | null {
  const selection = useEditorStore((s) => s.selection);

  const featureQueries = useQueries({
    queries: layers.map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
    })),
  });

  if (!selection) return null;

  for (let i = 0; i < layers.length; i++) {
    const found = featureQueries[i]?.data?.find((f) => f.id === selection.featureId);
    if (found) return { feature: found, layer: layers[i] };
  }
  return null;
}
