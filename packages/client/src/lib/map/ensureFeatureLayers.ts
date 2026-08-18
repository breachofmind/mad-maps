import type mapboxgl from 'mapbox-gl';
import { DEFAULT_LABEL_COLORS } from './basemapContrast';
import { pointHighlightFilter, textHighlightFilter, highlightFilter, hoverLabelFilter } from './featureLayerFilters';
import { FEATURE_SOURCE_ID, HOVER_CURSOR_SOURCE_ID, LAYER_IDS } from './featureLayerIds';
import {
  CURSOR_LABEL_OFFSET_EM,
  DEFAULT_HOVER_COLOR,
  EMPTY_FEATURE_COLLECTION,
  GEOMETRY_HOVER_WIDTH,
  HIGHLIGHT_FADE_DURATION_MS,
  HOVER_LABEL_OFFSET_EM,
  HOVER_LABEL_TEXT_SIZE,
  LINE_HIT_AREA_PADDING,
  POINT_HOVER_RADIUS,
  POINT_HOVER_STROKE_WIDTH,
  POINT_ICON_SIZE,
} from './featureLayerStyleConstants';
import {
  createTextSelectionBoxImage,
  TEXT_SELECTION_BOX_IMAGE_ID,
  TEXT_SELECTION_BOX_INSET,
  TEXT_SELECTION_BOX_SIZE,
} from './textSelectionBoxImage';

// Idempotent: if the source already exists (i.e. this map/style already has
// the local-feature layers set up), this just patches its data; otherwise it
// creates the source and every layer from scratch. Called both when `data`
// changes and — via useFeatureLayerMapSync's style.load handler — after a
// basemap switch wipes all custom sources/layers out.
export function ensureFeatureLayersAdded(map: mapboxgl.Map, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(FEATURE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }

  // dynamic:true enables updateData() (see useFeatureLayerMapSync's drag
  // handling) — dragging patches just the one moving feature instead of
  // re-sending/re-tiling this whole collection (which can be hundreds of
  // features) on every mousemove.
  map.addSource(FEATURE_SOURCE_ID, { type: 'geojson', data, dynamic: true });
  map.addLayer({
    id: LAYER_IDS.polygonFill,
    type: 'fill',
    source: FEATURE_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
  });
  map.addLayer({
    id: LAYER_IDS.polygonOutline,
    type: 'line',
    source: FEATURE_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'Polygon'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'strokeWidth'],
      'line-dasharray': ['get', 'dashArray'],
    },
  });
  // Inserted before polygonOutline (i.e. between it and polygonFill) so it
  // renders underneath both the polygon outline and the line layer (added
  // next), giving hovered LineStrings/Polygons a soft white glow behind
  // their crisp edge.
  map.addLayer(
    {
      id: LAYER_IDS.geometryHover,
      type: 'line',
      source: FEATURE_SOURCE_ID,
      filter: highlightFilter([], ['LineString', 'Polygon']),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': DEFAULT_HOVER_COLOR,
        'line-width': GEOMETRY_HOVER_WIDTH,
        'line-opacity': 0,
        'line-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
      },
    },
    LAYER_IDS.polygonOutline,
  );
  map.addLayer({
    id: LAYER_IDS.line,
    type: 'line',
    source: FEATURE_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'strokeWidth'],
      'line-dasharray': ['get', 'dashArray'],
    },
  });
  // Invisible, much wider than the visible line — see CLICKABLE_LAYER_IDS in
  // featureLayerIds.ts.
  map.addLayer({
    id: LAYER_IDS.lineHitArea,
    type: 'line',
    source: FEATURE_SOURCE_ID,
    filter: ['==', ['geometry-type'], 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': ['+', ['get', 'strokeWidth'], LINE_HIT_AREA_PADDING],
      'line-opacity': 0,
    },
  });
  map.addLayer({
    id: LAYER_IDS.point,
    type: 'symbol',
    source: FEATURE_SOURCE_ID,
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'featureType'], 'text']],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': POINT_ICON_SIZE,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  // Text is geometrically a Point (draggable/movable the same as a marker)
  // but rendered as bare centered text instead of an icon — see
  // buildFeatureCollection's featureType/fontSize properties. The zoom
  // interpolate factor scales the label noticeably with zoom (0.25x-3.2x)
  // while still being anchored on the user's chosen fontSize; zoom 12 is
  // the reference point where fontSize reads as literal on-screen px.
  // Shared by LAYER_IDS.textHover below so its box sizes against the exact
  // same rendered text size as the visible layer.
  const textSizeExpression: mapboxgl.ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    ['*', ['get', 'fontSize'], 0.01],
    8,
    ['*', ['get', 'fontSize'], 0.6],
    12,
    ['get', 'fontSize'],
    16,
    ['*', ['get', 'fontSize'], 1.8],
    22,
    ['*', ['get', 'fontSize'], 6.0],
  ];
  if (!map.hasImage(TEXT_SELECTION_BOX_IMAGE_ID)) {
    const contentInset = TEXT_SELECTION_BOX_INSET;
    const contentEnd = TEXT_SELECTION_BOX_SIZE - TEXT_SELECTION_BOX_INSET;
    map.addImage(TEXT_SELECTION_BOX_IMAGE_ID, createTextSelectionBoxImage(), {
      sdf: true,
      content: [contentInset, contentInset, contentEnd, contentEnd],
      stretchX: [[contentInset, contentEnd]],
      stretchY: [[contentInset, contentEnd]],
    });
  }
  // Hover/selection indicator for text features, in place of pointHover's
  // circle (a fixed-radius ring reads oddly around a variable-width label).
  // Added before LAYER_IDS.text so the box renders behind the actual text.
  // icon-text-fit stretches TEXT_SELECTION_BOX_IMAGE_ID to wrap this same
  // layer's own (invisible — text-opacity 0) text, so the box always
  // matches the visible layer's rendered text size exactly.
  map.addLayer({
    id: LAYER_IDS.textHover,
    type: 'symbol',
    source: FEATURE_SOURCE_ID,
    filter: textHighlightFilter([]),
    layout: {
      'text-field': ['get', 'title'],
      'text-size': textSizeExpression,
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'icon-image': TEXT_SELECTION_BOX_IMAGE_ID,
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [6, 8, 6, 8],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'text-opacity': 0,
      'icon-color': DEFAULT_HOVER_COLOR,
      'icon-opacity': 0,
      'icon-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
    },
  });
  map.addLayer({
    id: LAYER_IDS.text,
    type: 'symbol',
    source: FEATURE_SOURCE_ID,
    filter: ['==', ['get', 'featureType'], 'text'],
    layout: {
      'text-field': ['get', 'title'],
      'text-size': textSizeExpression,
      'text-anchor': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': ['get', 'color'],
    },
  });
  map.addLayer({
    id: LAYER_IDS.pointHover,
    type: 'circle',
    source: FEATURE_SOURCE_ID,
    filter: pointHighlightFilter([]),
    paint: {
      'circle-radius': POINT_HOVER_RADIUS,
      'circle-color': DEFAULT_HOVER_COLOR,
      'circle-opacity': 0,
      'circle-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
      'circle-stroke-width': POINT_HOVER_STROKE_WIDTH,
      'circle-stroke-color': DEFAULT_HOVER_COLOR,
      'circle-stroke-opacity': 0,
      'circle-stroke-opacity-transition': { duration: HIGHLIGHT_FADE_DURATION_MS },
    },
  });
  // Added last so it draws above icons/lines/polygons and their hover rings.
  // No background/box by design — just text with a halo for legibility,
  // per the "not an obstructive tooltip" ask this replaces.
  map.addLayer({
    id: LAYER_IDS.hoverLabel,
    type: 'symbol',
    source: FEATURE_SOURCE_ID,
    filter: hoverLabelFilter(null),
    layout: {
      'text-field': ['get', 'title'],
      'text-size': HOVER_LABEL_TEXT_SIZE,
      'text-anchor': 'bottom',
      'text-offset': [0, HOVER_LABEL_OFFSET_EM],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': DEFAULT_LABEL_COLORS.text,
      'text-halo-color': DEFAULT_LABEL_COLORS.halo,
      'text-halo-width': 1,
      'text-halo-blur': 0.5,
    },
  });
  // Cursor-following label for LineString/Polygon hover — see
  // HOVER_CURSOR_SOURCE_ID. Starts empty; useFeatureLayerMapSync's
  // mousemove handler drives its single feature's position and title live.
  map.addSource(HOVER_CURSOR_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURE_COLLECTION });
  map.addLayer({
    id: LAYER_IDS.hoverLabelCursor,
    type: 'symbol',
    source: HOVER_CURSOR_SOURCE_ID,
    layout: {
      'text-field': ['get', 'title'],
      'text-size': HOVER_LABEL_TEXT_SIZE,
      'text-anchor': 'top-left',
      'text-offset': CURSOR_LABEL_OFFSET_EM,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': DEFAULT_LABEL_COLORS.text,
      'text-halo-color': DEFAULT_LABEL_COLORS.halo,
      'text-halo-width': 1,
      'text-halo-blur': 0.5,
    },
  });
}
