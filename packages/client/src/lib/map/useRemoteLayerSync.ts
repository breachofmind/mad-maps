import { useEffect, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { LayerDTO } from '@mad-maps/shared';
import { isMakiIconName } from '@mad-maps/shared';
import { useEditorStore } from '../state/editorStore';
import { DEFAULT_LABEL_COLORS, labelColorsForHighlight, type LabelColors } from './basemapContrast';
import { ensureExternalIconImages } from './externalIconImages';
import { ensureFeatureIconImages } from './featureIconImages';
import { currentIconRules, normalizeStyleConfig } from '../layers/styleConfig';
import { ensureRemoteLayerAdded, removeRemoteLayer, setRemoteLayerVisibility } from './ensureRemoteLayer';
import { remoteSubLayerIds } from './remoteLayerIds';
import { EMPTY_REMOTE_COLLECTION } from './remoteLayerStyleConstants';
import { useBasemapContrastColor } from './useBasemapContrastColor';

export interface RemoteSubLayerMeta {
  layerId: string;
  layerName: string;
  layerColor: string;
}

interface RemoteDataQuery {
  data: GeoJSON.FeatureCollection | undefined;
  dataUpdatedAt: number;
}

interface UseRemoteLayerSyncOptions {
  map: mapboxgl.Map | null;
  remoteLayers: LayerDTO[];
  dataQueries: RemoteDataQuery[];
}

// Wires each geojson-url/pmtiles-url layer's Mapbox source/sublayers to this
// map instance and keeps them synced with `remoteLayers`/`dataQueries`,
// surviving basemap switches (a 'style.load' wipes all custom sources/layers,
// so everything is recreated on that event too) and legibility against
// whatever basemap is currently showing. Returns a ref to the current
// sub-layer-id -> layer metadata map, for callers that need to resolve a
// clicked layer id back to its owning layer (see useRemoteLayerClickSelection).
export function useRemoteLayerSync({ map, remoteLayers, dataQueries }: UseRemoteLayerSyncOptions) {
  const stateRef = useRef({ remoteLayers, dataQueries });
  stateRef.current = { remoteLayers, dataQueries };
  const knownLayerIdsRef = useRef<Set<string>>(new Set());
  const layerMetaBySubLayerRef = useRef<Map<string, RemoteSubLayerMeta>>(new Map());
  // Which icon urls have successfully loaded onto the *current* map style —
  // starts empty each style load since runtime images don't survive a style
  // change, then fills in as ensureExternalIconImages resolves (see below).
  const loadedIconUrlsRef = useRef<Set<string>>(new Set());
  // Updated by the contrast-sampling effect below; read here so a
  // newly-added layer's label starts out with the last-known-good colors
  // instead of always the light-basemap default.
  const labelColorsRef = useRef<LabelColors>(DEFAULT_LABEL_COLORS);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    function syncLayers() {
      if (!map) return;
      const { remoteLayers: currentLayers, dataQueries: currentQueries } = stateRef.current;
      const currentIds = new Set(currentLayers.map((l) => l.id));

      for (const id of knownLayerIdsRef.current) {
        if (!currentIds.has(id)) removeRemoteLayer(map, id);
      }
      knownLayerIdsRef.current = currentIds;

      const meta = new Map<string, RemoteSubLayerMeta>();
      currentLayers.forEach((layer, index) => {
        const data = currentQueries[index]?.data ?? EMPTY_REMOTE_COLLECTION;
        ensureRemoteLayerAdded(map, layer, loadedIconUrlsRef.current, labelColorsRef.current, data);
        setRemoteLayerVisibility(map, layer.id, layer.visible);
        for (const subLayerId of Object.values(remoteSubLayerIds(layer.id))) {
          meta.set(subLayerId, { layerId: layer.id, layerName: layer.name, layerColor: layer.color });
        }
      });
      layerMetaBySubLayerRef.current = meta;

      const iconValues = currentLayers
        .flatMap((l) => {
          const normalized = normalizeStyleConfig(l.styleConfig);
          return [
            ...currentIconRules(normalized).map((r) => ({ value: r.iconUrl, color: l.color })),
            ...(normalized.defaultIconUrl ? [{ value: normalized.defaultIconUrl, color: l.color }] : []),
          ];
        })
        .filter((ref) => ref.value);

      // Maki icons are rasterized locally and can't fail to load (see
      // isIconUsable), so they're registered independently of the
      // url-loaded/failed tracking below — no need to re-run syncLayers once
      // they resolve, since ensureRemoteLayerAdded already treats them as
      // usable and Mapbox repaints automatically once the image is added.
      const makiRefs = iconValues
        .filter((ref) => isMakiIconName(ref.value))
        .map((ref) => ({ icon: ref.value, color: ref.color }));
      if (makiRefs.length > 0) {
        ensureFeatureIconImages(map, makiRefs).catch((err) => console.error('Failed to register remote layer icons', err));
      }

      const iconUrls = iconValues.filter((ref) => !isMakiIconName(ref.value)).map((ref) => ref.value);
      if (iconUrls.length === 0) return;
      ensureExternalIconImages(map, iconUrls).then(({ loaded, failed }) => {
        if (cancelled) return;
        useEditorStore.getState().setFailedIconUrls(failed);
        const prev = loadedIconUrlsRef.current;
        const changed = loaded.size !== prev.size || [...loaded].some((url) => !prev.has(url));
        loadedIconUrlsRef.current = loaded;
        // Re-run only once newly-loaded images actually change which points
        // qualify for the icon layer — loadCached's cache means repeat
        // calls resolve near-instantly once everything's warm.
        if (changed) syncLayers();
      });
    }

    syncLayers();
    map.on('style.load', syncLayers);
    return () => {
      cancelled = true;
      map.off('style.load', syncLayers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    remoteLayers
      .map(
        (l) =>
          `${l.id}:${l.name}:${l.color}:${l.visible}:${l.sourceType}:${l.sourceUrl}:${l.sourceLayer}:${JSON.stringify(l.styleConfig)}`,
      )
      .join(','),
    dataQueries.map((q) => q.dataUpdatedAt).join(','),
  ]);

  // Keeps label text/halo colors legible against the actual basemap.
  useBasemapContrastColor(map, (targetMap, color) => {
    labelColorsRef.current = labelColorsForHighlight(color);
    for (const layer of stateRef.current.remoteLayers) {
      const id = remoteSubLayerIds(layer.id).label;
      if (!targetMap.getLayer(id)) continue;
      targetMap.setPaintProperty(id, 'text-color', labelColorsRef.current.text);
      targetMap.setPaintProperty(id, 'text-halo-color', labelColorsRef.current.halo);
    }
  });

  return layerMetaBySubLayerRef;
}
