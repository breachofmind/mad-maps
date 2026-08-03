import { useQueries } from '@tanstack/react-query';
import type { LayerDTO, MapFeatureDTO } from '@mapinski/shared';
import { useEditorStore } from '../state/editorStore';
import { featuresQueryKey, fetchFeatures } from './api';

export interface SelectedFeature {
  feature: MapFeatureDTO;
  layer: LayerDTO;
}

// Order follows selection.featureIds (i.e. the order features were
// shift-clicked in), so the bulk properties panel doesn't jump features
// around as the selection grows.
export function useSelectedFeatures(layers: LayerDTO[]): SelectedFeature[] {
  const selection = useEditorStore((s) => s.selection);

  const featureQueries = useQueries({
    queries: layers.map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
    })),
  });

  if (!selection) return [];

  const result: SelectedFeature[] = [];
  for (const featureId of selection.featureIds) {
    for (let i = 0; i < layers.length; i++) {
      const found = featureQueries[i]?.data?.find((f) => f.id === featureId);
      if (found) {
        result.push({ feature: found, layer: layers[i] });
        break;
      }
    }
  }
  return result;
}
