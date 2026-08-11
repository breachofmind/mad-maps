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
