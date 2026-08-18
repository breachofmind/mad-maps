import type mapboxgl from 'mapbox-gl';

export function highlightFilter(featureIds: string[], geometryTypes: string[]): mapboxgl.FilterSpecification {
  return [
    'all',
    ['in', ['geometry-type'], ['literal', geometryTypes]],
    ['in', ['get', 'featureId'], ['literal', featureIds]],
  ];
}

// pointHover's ring only makes sense for icon markers — text gets its own
// box (LAYER_IDS.textHover) instead, so it's excluded here even though it's
// also Point geometry.
export function pointHighlightFilter(featureIds: string[]): mapboxgl.FilterSpecification {
  return ['all', highlightFilter(featureIds, ['Point']), ['!=', ['get', 'featureType'], 'text']];
}

export function textHighlightFilter(featureIds: string[]): mapboxgl.FilterSpecification {
  return ['all', ['==', ['get', 'featureType'], 'text'], ['in', ['get', 'featureId'], ['literal', featureIds]]];
}

// '' never matches a real featureId, so this renders nothing when nothing's
// hovered rather than needing a separate "none hovered" branch. Restricted
// to Points — LineStrings/Polygons use the cursor-following label instead
// (see LAYER_IDS.hoverLabelCursor), since a fixed geometry anchor can end up
// far from the cursor on a large shape.
export function hoverLabelFilter(hoveredFeatureId: string | null): mapboxgl.FilterSpecification {
  return [
    'all',
    ['==', ['geometry-type'], 'Point'],
    // Text features already render their own title permanently — this
    // hover-triggered label would just duplicate it.
    ['!=', ['get', 'featureType'], 'text'],
    ['==', ['get', 'featureId'], hoveredFeatureId ?? ''],
    ['!=', ['get', 'title'], ''],
  ];
}
