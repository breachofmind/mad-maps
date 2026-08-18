// Layer ids shared between FeatureLayer.tsx and other map tools that need to
// hit-test against rendered features (e.g. the route tool snapping to pins).
// Kept in their own dependency-free module so importing an id doesn't pull
// in FeatureLayer's own react-query/api-client graph (which uses
// import.meta.env and breaks Jest's CJS transform).
export const FEATURE_POINT_LAYER_ID = 'mad-maps-features-point';

// Every RemoteLayer.tsx sub-layer id is prefixed with this, so other map
// tools (e.g. FeatureLayer's hover cursor) can recognize a hit on an
// external-data feature without importing RemoteLayer's own internals.
export const REMOTE_LAYER_ID_PREFIX = 'mad-maps-remote-';

export const FEATURE_SOURCE_ID = 'mad-maps-features';
// Separate single-feature source the cursor-following label (see
// CURSOR_LABEL_OFFSET_EM in featureLayerStyleConstants.ts) is driven from —
// its data is a lngLat updated on every mousemove, independent of the real
// feature geometry, so it can't share LAYER_IDS.hoverLabel's
// FEATURE_SOURCE_ID-backed, geometry-anchored layer.
export const HOVER_CURSOR_SOURCE_ID = 'mad-maps-features-hover-cursor';

export const LAYER_IDS = {
  polygonFill: 'mad-maps-features-polygon-fill',
  polygonOutline: 'mad-maps-features-polygon-outline',
  line: 'mad-maps-features-line',
  lineHitArea: 'mad-maps-features-line-hit-area',
  point: FEATURE_POINT_LAYER_ID,
  textHover: 'mad-maps-features-text-hover',
  text: 'mad-maps-features-text',
  pointHover: 'mad-maps-features-point-hover',
  geometryHover: 'mad-maps-features-geometry-hover',
  hoverLabel: 'mad-maps-features-hover-label',
  hoverLabelCursor: 'mad-maps-features-hover-label-cursor',
};

// Bottom-to-top order these are added in by ensureFeatureLayersAdded
// (ensureFeatureLayers.ts) — used by lib/map/layerZOrder.ts to reposition
// this whole local-layers block (all local layers share this one Mapbox
// layer set) relative to remote layers' own groups when the user reorders
// layers in the panel.
export const FEATURE_LAYER_Z_ORDER_IDS = [
  LAYER_IDS.polygonFill,
  LAYER_IDS.geometryHover,
  LAYER_IDS.polygonOutline,
  LAYER_IDS.line,
  LAYER_IDS.lineHitArea,
  LAYER_IDS.point,
  LAYER_IDS.textHover,
  LAYER_IDS.text,
  LAYER_IDS.pointHover,
  LAYER_IDS.hoverLabel,
  LAYER_IDS.hoverLabelCursor,
];

// Click/hover hit-testing uses the invisible, much-wider lineHitArea layer
// instead of the visible line layer, since a thin rendered line is a hard
// target to click precisely — see lineHitArea's paint in
// ensureFeatureLayers.ts.
export const CLICKABLE_LAYER_IDS = [LAYER_IDS.polygonFill, LAYER_IDS.lineHitArea, LAYER_IDS.point, LAYER_IDS.text];
