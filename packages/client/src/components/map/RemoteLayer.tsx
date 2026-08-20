import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'dompurify';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO, MapFeaturePropertiesDTO } from '@mad-maps/shared';
import { useEditorStore } from '../../lib/state/editorStore';
import { externalLayerDataQueryKey, fetchExternalLayerData } from '../../lib/layers/api';
import { createFeature, featuresQueryKey } from '../../lib/mapFeatures/api';
import { SANITIZE_CONFIG } from '../../lib/mapFeatures/sanitizeConfig';
import { buildCopiedDescriptionHtml, COPYABLE_GEOMETRY_TYPES } from '../../lib/mapFeatures/copyRemoteFeature';
import { useRemoteLayerSync } from '../../lib/map/useRemoteLayerSync';
import { useRemoteLayerClickSelection } from '../../lib/map/useRemoteLayerClickSelection';
import { RemoteFeaturePopup } from './RemoteFeaturePopup';

export { remoteLayerZOrderIds } from '../../lib/map/remoteLayerIds';

interface RemoteLayerProps {
  map: mapboxgl.Map | null;
  layers: LayerDTO[];
}

// Renders layers backed by an external GeoJSON URL (see AddExternalLayerDialog)
// directly from fetched data, without persisting individual features to
// map_features — a sibling to FeatureLayer, which owns the user-drawn data.
// Z-order between this component's layers, FeatureLayer's, and each other is
// not decided here — see lib/map/layerZOrder.ts, applied by MapEditorPage
// after both have synced.
export function RemoteLayer({ map, layers }: RemoteLayerProps) {
  const remoteLayers = layers.filter(
    (layer) => layer.sourceType === 'geojson-url' || layer.sourceType === 'pmtiles-url' || layer.sourceType === 'raster-url',
  );
  const queryClient = useQueryClient();
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;

  // pmtiles-url and raster-url layers render straight from their source URL
  // via a Mapbox vector/raster source (see ensureRemoteLayerAdded) — no
  // server round-trip, so no query is enabled for them here.
  const dataQueries = useQueries({
    queries: remoteLayers.map((layer) => ({
      queryKey: externalLayerDataQueryKey(layer.id),
      queryFn: () => fetchExternalLayerData(layer.id),
      enabled: layer.sourceType === 'geojson-url',
      staleTime: Infinity,
    })),
  });

  const layerMetaBySubLayerRef = useRemoteLayerSync({ map, remoteLayers, dataQueries });
  const [selection, setSelection] = useRemoteLayerClickSelection(map, layerMetaBySubLayerRef);

  const addFeatureMutation = useMutation({
    mutationFn: ({
      layerId,
      geometry,
      properties,
    }: {
      layerId: string;
      geometry: GeoJSON.Geometry;
      properties: Partial<MapFeaturePropertiesDTO>;
    }) => createFeature(layerId, { geometry, properties }),
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: featuresQueryKey(vars.layerId) });
      setSelection(null);
    },
  });

  const selectionGeometryType = selection?.feature.geometry?.type;
  let addDisabledReason: string | null = null;
  if (!activeLayer) {
    addDisabledReason = 'Select a layer first';
  } else if (activeLayer.sourceType !== 'local') {
    addDisabledReason = 'Select one of your own layers first';
  } else if (!selectionGeometryType || !COPYABLE_GEOMETRY_TYPES.has(selectionGeometryType)) {
    addDisabledReason = "This feature's shape can't be copied yet";
  }

  function handleAddToActiveLayer() {
    if (!selection || !activeLayer || addDisabledReason) return;
    const sourceLayer = layers.find((l) => l.id === selection.layerId);
    const labelProperty = sourceLayer?.styleConfig?.labelProperty ?? null;
    const rawTitle = labelProperty ? selection.feature.properties?.[labelProperty] : undefined;
    addFeatureMutation.mutate({
      layerId: activeLayer.id,
      geometry: selection.feature.geometry,
      properties: {
        title: rawTitle != null ? String(rawTitle) : '',
        descriptionHtml: DOMPurify.sanitize(
          buildCopiedDescriptionHtml(selection.feature.properties, labelProperty),
          SANITIZE_CONFIG,
        ),
        color: activeLayer.color,
        icon: activeLayer.defaultIcon,
      },
    });
  }

  return (
    <RemoteFeaturePopup
      map={map}
      selection={selection}
      onClose={() => setSelection(null)}
      activeLayerName={activeLayer?.sourceType === 'local' ? activeLayer.name : null}
      addDisabledReason={addDisabledReason}
      isAdding={addFeatureMutation.isPending}
      onAddToActiveLayer={handleAddToActiveLayer}
    />
  );
}
