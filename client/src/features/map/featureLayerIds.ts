// Layer ids shared between FeatureLayer.tsx and other map tools that need to
// hit-test against rendered features (e.g. the route tool snapping to pins).
// Kept in their own dependency-free module so importing an id doesn't pull
// in FeatureLayer's own react-query/api-client graph (which uses
// import.meta.env and breaks Jest's CJS transform).
export const FEATURE_POINT_LAYER_ID = 'mapinski-features-point';
