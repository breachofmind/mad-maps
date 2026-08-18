export const EMPTY_REMOTE_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
export const REMOTE_FILL_OPACITY = 0.25;
export const REMOTE_LINE_WIDTH = 3;
export const REMOTE_OUTLINE_WIDTH = 2;
export const REMOTE_POINT_RADIUS = 6;
export const REMOTE_POINT_STROKE_WIDTH = 1.5;
export const REMOTE_POINT_STROKE_COLOR = '#ffffff';
export const REMOTE_LABEL_TEXT_SIZE = 12;
export const REMOTE_LABEL_OFFSET_EM = 1.4;
export const REMOTE_ICON_SIZE = 0.5;

// mapbox-gl doesn't export its `ExpressionSpecification` type, so this is a
// minimal structural stand-in (a tuple with a string operator head) that's
// still assignable to the paint/filter spec's expression types.
export type MapboxExpression = [string, ...unknown[]];

// Always evaluates false — used as a sentinel filter for the icon sub-layer
// when no icon rule is active, so the layer exists (for style-load
// resilience) but renders nothing.
export const NEVER_FILTER: MapboxExpression = ['literal', false];
