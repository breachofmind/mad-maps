import { useMemo } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, MapFeatureDTO } from '@mad-maps/shared';
import { useEditorStore } from '../../lib/state/editorStore';
import { featuresQueryKey, fetchFeatures, updateFeature } from '../../lib/mapFeatures/api';
import { buildFeatureCollection } from '../../lib/map/buildFeatureCollection';
import { applyFeatureLayerContrastColor } from '../../lib/map/featureLayerHighlight';
import { useBasemapContrastColor } from '../../lib/map/useBasemapContrastColor';
import { useFeatureLayerMapSync } from '../../lib/map/useFeatureLayerMapSync';

export { FEATURE_LAYER_Z_ORDER_IDS } from '../../lib/map/featureLayerIds';

interface FeatureLayerProps {
  map: mapboxgl.Map | null;
  layers: LayerDTO[];
  // Excluded from this layer's own rendering while its vertices are being
  // edited via mapbox-gl-draw's direct_select mode, which draws its own
  // overlay for it — without this it would render twice.
  editingFeatureId?: string | null;
}

export function FeatureLayer({ map, layers, editingFeatureId = null }: FeatureLayerProps) {
  const queryClient = useQueryClient();

  const moveFeatureMutation = useMutation({
    mutationFn: ({ featureId, lng, lat }: { featureId: string; layerId: string; lng: number; lat: number }) =>
      updateFeature(featureId, { geometry: { type: 'Point', coordinates: [lng, lat] } }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(vars.layerId) });
    },
  });

  const featureQueries = useQueries({
    queries: layers.map((layer) => ({
      queryKey: featuresQueryKey(layer.id),
      queryFn: () => fetchFeatures(layer.id),
    })),
  });

  const { data, iconRefs } = useMemo(() => {
    const featuresByLayer = new Map<string, MapFeatureDTO[]>();
    layers.forEach((layer, index) => {
      featuresByLayer.set(layer.id, featureQueries[index]?.data ?? []);
    });
    const { collection, iconRefs } = buildFeatureCollection(layers, featuresByLayer, editingFeatureId);
    return { data: collection, iconRefs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, editingFeatureId, featureQueries.map((q) => q.dataUpdatedAt).join(',')]);

  useFeatureLayerMapSync({
    map,
    data,
    iconRefs,
    editingFeatureId,
    onMoveFeature: ({ featureId, layerId, lng, lat, previousGeometry }) => {
      useEditorStore.getState().pushMoveHistory({ featureId, layerId, previousGeometry });
      moveFeatureMutation.mutate({ featureId, layerId, lng, lat });
    },
  });

  useBasemapContrastColor(map, applyFeatureLayerContrastColor);

  return null;
}
