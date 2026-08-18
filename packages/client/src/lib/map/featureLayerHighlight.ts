import type mapboxgl from 'mapbox-gl';
import { labelColorsForHighlight } from './basemapContrast';
import { LAYER_IDS } from './featureLayerIds';
import { highlightFilter, pointHighlightFilter, textHighlightFilter } from './featureLayerFilters';
import { HIGHLIGHT_FADE_DURATION_MS, POINT_HOVER_OPACITY } from './featureLayerStyleConstants';

export interface HighlightFadeState {
  // The feature ids the hover/selection layers are currently filtered to
  // render. While fading out this lags one step behind the real
  // hovered/selected ids (see applyHighlight) so there's still something on
  // screen for the opacity transition to actually animate.
  renderedIds: string[];
  fadeOutTimeoutId: number | null;
}

function setHighlightFilters(map: mapboxgl.Map, featureIds: string[]) {
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setFilter(LAYER_IDS.pointHover, pointHighlightFilter(featureIds));
  }
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setFilter(LAYER_IDS.geometryHover, highlightFilter(featureIds, ['LineString', 'Polygon']));
  }
  if (map.getLayer(LAYER_IDS.textHover)) {
    map.setFilter(LAYER_IDS.textHover, textHighlightFilter(featureIds));
  }
}

function setHighlightOpacity(map: mapboxgl.Map, visible: boolean) {
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-opacity', visible ? POINT_HOVER_OPACITY : 0);
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-stroke-opacity', visible ? 1 : 0);
  }
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setPaintProperty(LAYER_IDS.geometryHover, 'line-opacity', visible ? 1 : 0);
  }
  if (map.getLayer(LAYER_IDS.textHover)) {
    map.setPaintProperty(LAYER_IDS.textHover, 'icon-opacity', visible ? 1 : 0);
  }
}

// pointHover doubles as the selected-pin ring, and geometryHover doubles as
// the selected line/polygon border: both get the same contrast-aware
// highlight color (see applyContrastColor below) for a hovered feature and a
// selected one, driven off whichever feature ids are hovered and/or
// currently selected. (While a line/polygon is being vertex-edited it's
// excluded from this layer's data entirely — see buildFeatureCollection's
// editingFeatureId check — so there's nothing here to highlight in that
// case; mapbox-gl-draw renders its own overlay.)
//
// Membership (which features these layers render) is still filter-based —
// mapbox-gl-js's *-transition paint properties don't reliably animate when
// driven by feature-state (confirmed open bug, mapbox/mapbox-gl-js#12685;
// Mapbox's own official transition example uses setPaintProperty directly,
// never feature-state). So the fade is done at the *layer* level instead:
// opacity toggles between 0 and its visible value via setPaintProperty
// whenever highlighted-ness flips between "nothing" and "something".
//
// Fading in is simple: the filter and the opacity ramp can change together,
// since the newly-shown feature has nothing to visually jump from. Fading
// out is the opposite problem — setFilter takes effect instantly, so
// dropping a feature from the filter at the same moment as starting the
// opacity ramp would erase it before the transition ever gets a frame to
// play. So on the way out, the feature is kept in the filter (fadeState
// tracks it as `renderedIds`) while opacity ramps down, and only removed
// from the filter once the transition has had time to finish. Swapping the
// highlight directly from one feature to another (without passing through
// "nothing highlighted") still doesn't itself fade, since the opacity value
// never changes in that case — only entering/leaving "nothing highlighted"
// does.
export function applyHighlight(
  map: mapboxgl.Map,
  hoveredFeatureId: string | null,
  selectedFeatureIds: string[],
  fadeState: HighlightFadeState,
) {
  const highlightedIds = [
    ...new Set([...(hoveredFeatureId !== null ? [hoveredFeatureId] : []), ...selectedFeatureIds]),
  ];
  const visible = highlightedIds.length > 0;

  if (fadeState.fadeOutTimeoutId !== null) {
    window.clearTimeout(fadeState.fadeOutTimeoutId);
    fadeState.fadeOutTimeoutId = null;
  }

  if (visible) {
    fadeState.renderedIds = highlightedIds;
    setHighlightFilters(map, highlightedIds);
    setHighlightOpacity(map, true);
    return;
  }

  setHighlightFilters(map, fadeState.renderedIds);
  setHighlightOpacity(map, false);
  fadeState.fadeOutTimeoutId = window.setTimeout(() => {
    fadeState.renderedIds = [];
    fadeState.fadeOutTimeoutId = null;
    setHighlightFilters(map, []);
  }, HIGHLIGHT_FADE_DURATION_MS);
}

// Keeps the hover/selection highlight layers legible against the actual
// basemap — called from useBasemapContrastColor with a freshly sampled
// color whenever the basemap (re)loads.
export function applyFeatureLayerContrastColor(map: mapboxgl.Map, color: string) {
  if (map.getLayer(LAYER_IDS.geometryHover)) {
    map.setPaintProperty(LAYER_IDS.geometryHover, 'line-color', color);
  }
  if (map.getLayer(LAYER_IDS.pointHover)) {
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-color', color);
    map.setPaintProperty(LAYER_IDS.pointHover, 'circle-stroke-color', color);
  }
  if (map.getLayer(LAYER_IDS.textHover)) {
    map.setPaintProperty(LAYER_IDS.textHover, 'icon-color', color);
  }
  const labelColors = labelColorsForHighlight(color);
  if (map.getLayer(LAYER_IDS.hoverLabel)) {
    map.setPaintProperty(LAYER_IDS.hoverLabel, 'text-color', labelColors.text);
    map.setPaintProperty(LAYER_IDS.hoverLabel, 'text-halo-color', labelColors.halo);
  }
  if (map.getLayer(LAYER_IDS.hoverLabelCursor)) {
    map.setPaintProperty(LAYER_IDS.hoverLabelCursor, 'text-color', labelColors.text);
    map.setPaintProperty(LAYER_IDS.hoverLabelCursor, 'text-halo-color', labelColors.halo);
  }
}
