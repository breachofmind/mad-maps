import type mapboxgl from 'mapbox-gl';
import type { LayerDTO } from '@mad-maps/shared';
import type { LabelColors } from './basemapContrast';
import { remoteSourceId, remoteSubLayerIds } from './remoteLayerIds';
import {
  buildColorExpression,
  iconImageExpression,
  iconLayerFilter,
  labelTextField,
  pointFilter,
  pointIconFilter,
} from './remoteLayerExpressions';
import {
  REMOTE_FILL_OPACITY,
  REMOTE_ICON_SIZE,
  REMOTE_LABEL_OFFSET_EM,
  REMOTE_LABEL_TEXT_SIZE,
  REMOTE_LINE_WIDTH,
  REMOTE_OUTLINE_WIDTH,
  REMOTE_POINT_RADIUS,
  REMOTE_POINT_STROKE_COLOR,
  REMOTE_POINT_STROKE_WIDTH,
} from './remoteLayerStyleConstants';

// Mapbox's `geometry-type` expression already collapses Multi* geometries
// into their singular counterpart (MultiPolygon -> 'Polygon', etc.), so no
// separate handling is needed for them here — see FeatureLayer.tsx's own
// use of the same expression for local features.
export function ensureRemoteLayerAdded(
  map: mapboxgl.Map,
  layer: LayerDTO,
  loadedIconUrls: ReadonlySet<string>,
  labelColors: LabelColors,
  data: GeoJSON.FeatureCollection,
) {
  const layerId = layer.id;
  const id = remoteSourceId(layerId);
  const ids = remoteSubLayerIds(layerId);
  const colorExpression = buildColorExpression(layer.color, layer.styleConfig);
  const iconFilter = pointIconFilter(layer.styleConfig, loadedIconUrls);
  const styleConfig = layer.styleConfig;
  // Vector sources (pmtiles-url) have no setData equivalent — a fetched
  // tile is immutable once loaded, and the source URL/source-layer are
  // fixed at layer-creation time, so there's nothing to refresh here.
  const isVectorSource = layer.sourceType === 'pmtiles-url';
  const sourceLayerProps = isVectorSource ? { 'source-layer': layer.sourceLayer! } : {};
  const existing = map.getSource(id) as mapboxgl.GeoJSONSource | mapboxgl.VectorTileSource | undefined;
  if (existing) {
    if (!isVectorSource) (existing as mapboxgl.GeoJSONSource).setData(data);
    if (map.getLayer(ids.fill)) map.setPaintProperty(ids.fill, 'fill-color', colorExpression);
    if (map.getLayer(ids.outline)) map.setPaintProperty(ids.outline, 'line-color', colorExpression);
    if (map.getLayer(ids.line)) map.setPaintProperty(ids.line, 'line-color', colorExpression);
    if (map.getLayer(ids.point)) {
      map.setPaintProperty(ids.point, 'circle-color', colorExpression);
      map.setFilter(ids.point, pointFilter(iconFilter));
    }
    if (map.getLayer(ids.label)) {
      map.setLayoutProperty(ids.label, 'text-field', labelTextField(styleConfig?.labelProperty));
      map.setPaintProperty(ids.label, 'text-color', labelColors.text);
      map.setPaintProperty(ids.label, 'text-halo-color', labelColors.halo);
    }
    if (map.getLayer(ids.icon)) {
      map.setFilter(ids.icon, iconLayerFilter(iconFilter));
      map.setLayoutProperty(ids.icon, 'icon-image', iconImageExpression(layer.color, styleConfig, loadedIconUrls));
    }
    return;
  }

  if (isVectorSource) {
    // 'pmtiles' is a built-in Mapbox GL TileProvider name — the browser
    // lazy-loads Mapbox's own official provider module the first time a
    // vector source references it, which reads tiles from the archive at
    // this URL via HTTP range requests. No protocol registration needed.
    map.addSource(id, { type: 'vector', url: layer.sourceUrl!, provider: 'pmtiles' });
  } else {
    map.addSource(id, { type: 'geojson', data });
  }
  map.addLayer({
    id: ids.fill,
    type: 'fill',
    source: id,
    ...sourceLayerProps,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': colorExpression, 'fill-opacity': REMOTE_FILL_OPACITY },
  });
  map.addLayer({
    id: ids.outline,
    type: 'line',
    source: id,
    ...sourceLayerProps,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colorExpression, 'line-width': REMOTE_OUTLINE_WIDTH },
  });
  map.addLayer({
    id: ids.line,
    type: 'line',
    source: id,
    ...sourceLayerProps,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colorExpression, 'line-width': REMOTE_LINE_WIDTH },
  });
  map.addLayer({
    id: ids.point,
    type: 'circle',
    source: id,
    ...sourceLayerProps,
    filter: pointFilter(iconFilter),
    paint: {
      'circle-color': colorExpression,
      'circle-radius': REMOTE_POINT_RADIUS,
      'circle-stroke-color': REMOTE_POINT_STROKE_COLOR,
      'circle-stroke-width': REMOTE_POINT_STROKE_WIDTH,
    },
  });
  // Points whose iconProperty value matches a loaded icon rule — or, absent
  // a match, the layer's default pin — render here instead of on the circle
  // layer above (see pointFilter/pointIconFilter).
  map.addLayer({
    id: ids.icon,
    type: 'symbol',
    source: id,
    ...sourceLayerProps,
    filter: iconLayerFilter(iconFilter),
    layout: {
      'icon-image': iconImageExpression(layer.color, styleConfig, loadedIconUrls),
      'icon-size': REMOTE_ICON_SIZE,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  // No geometry-type filter: unlike the layers above, labels apply across
  // Points, LineStrings, and Polygons alike, using Mapbox's default symbol
  // placement to pick a representative anchor per geometry (e.g. a
  // polygon's interior point).
  map.addLayer({
    id: ids.label,
    type: 'symbol',
    source: id,
    ...sourceLayerProps,
    layout: {
      'text-field': labelTextField(styleConfig?.labelProperty),
      'text-size': REMOTE_LABEL_TEXT_SIZE,
      'text-anchor': 'top',
      'text-offset': [0, REMOTE_LABEL_OFFSET_EM],
    },
    paint: {
      'text-color': labelColors.text,
      'text-halo-color': labelColors.halo,
      'text-halo-width': 1,
      'text-halo-blur': 0.5,
    },
  });
}

export function removeRemoteLayer(map: mapboxgl.Map, layerId: string) {
  const ids = remoteSubLayerIds(layerId);
  for (const id of Object.values(ids)) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(remoteSourceId(layerId))) map.removeSource(remoteSourceId(layerId));
}

export function setRemoteLayerVisibility(map: mapboxgl.Map, layerId: string, visible: boolean) {
  const ids = remoteSubLayerIds(layerId);
  const visibility = visible ? 'visible' : 'none';
  for (const id of Object.values(ids)) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
  }
}
