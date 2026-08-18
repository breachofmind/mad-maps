import type { LayerDTO, MapFeatureDTO } from '@mad-maps/shared';
import { featureIconImageId, type FeatureIconRef } from './featureIconImages';
import { DEFAULT_STROKE_WIDTH, DEFAULT_TEXT_FONT_SIZE, LINE_DASH_ARRAYS } from './featureLayerStyleConstants';

export function buildFeatureCollection(
  layers: LayerDTO[],
  featuresByLayer: Map<string, MapFeatureDTO[]>,
  editingFeatureId: string | null,
): { collection: GeoJSON.FeatureCollection; iconRefs: FeatureIconRef[] } {
  const features: GeoJSON.Feature[] = [];
  const iconRefs: FeatureIconRef[] = [];
  // All local layers share one Mapbox layer/source, so within it, stacking
  // is purely a function of array order (later features draw on top).
  // `layers` is top-of-panel-first (highest priority first) — push in
  // reverse so the topmost-in-panel layer's features end up last, and thus
  // on top.
  for (const layer of [...layers].reverse()) {
    if (!layer.visible) continue;
    for (const feature of featuresByLayer.get(layer.id) ?? []) {
      if (feature.id === editingFeatureId) continue;
      const color = feature.properties.color || layer.color;
      const icon = feature.properties.icon || 'marker';
      if (feature.featureType !== 'text') iconRefs.push({ icon, color });
      features.push({
        type: 'Feature',
        id: feature.id,
        geometry: feature.geometry,
        properties: {
          featureId: feature.id,
          layerId: layer.id,
          featureType: feature.featureType,
          color,
          title: feature.properties.title,
          icon: featureIconImageId(icon, color),
          fontSize: feature.properties.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
          strokeWidth: feature.properties.strokeWidth ?? DEFAULT_STROKE_WIDTH,
          dashArray: LINE_DASH_ARRAYS[feature.properties.lineStyle ?? 'solid'],
        },
      });
    }
  }
  return { collection: { type: 'FeatureCollection', features }, iconRefs };
}
