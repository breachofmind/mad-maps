// A copy of mapbox-gl-draw's default theme (its src/lib/theme.js, which the
// published package doesn't export separately — only the root MapboxDraw
// class and its .modes are public) with larger vertex/midpoint control
// points so they're easier to click and drag. Everything else matches the
// built-in look.
const blue = '#3bb2d0';
const orange = '#fbb03b';
const white = '#fff';

// Authored id — mapbox-gl-draw's own options.js addSources() splits every
// style layer here into "hot" (actively changing) and "cold" (settled)
// runtime variants, appending the suffix to this id; the bare id below is
// never itself a real map layer (same convention FeatureLayer.tsx's
// DRAW_VERTEX_LAYER_IDS already relies on for the vertex-handle layers).
export const GL_DRAW_LINES_LAYER_ID = 'gl-draw-lines';

// The in-progress feature useMapboxDraw.ts pulses the opacity of (see
// usePulseOpacity.ts) usually renders on the "hot" source — mapbox-gl-draw
// buckets a feature there for as long as its geometry keeps changing, which
// is what's happening while the user is actively placing points. But a
// render tick where nothing changed (e.g. the mouse briefly stops moving)
// bumps the *same* active feature over to "cold" instead — so both are
// pulsed together, in case the in-progress feature ever renders through
// "cold" for a tick.
export const GL_DRAW_LINES_HOT_LAYER_ID = `${GL_DRAW_LINES_LAYER_ID}.hot`;
export const GL_DRAW_LINES_COLD_LAYER_ID = `${GL_DRAW_LINES_LAYER_ID}.cold`;

// Matches the route tool's own waypoint-connector dash pattern
// (useMapboxRoute.ts) so both drawing tools read as the same visual
// language.
export const DASH_LENGTH = 0.2;
export const GAP_LENGTH = 2;

export const DRAW_STYLES: object[] = [
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': ['case', ['==', ['get', 'active'], 'true'], orange, blue],
      'fill-opacity': 0.1,
    },
  },
  {
    id: GL_DRAW_LINES_LAYER_ID,
    type: 'line',
    filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['==', ['get', 'active'], 'true'], orange, blue],
      'line-dasharray': ['case', ['==', ['get', 'active'], 'true'], [DASH_LENGTH, GAP_LENGTH], [2, 0]],
      'line-width': 2,
    },
  },
  {
    id: 'gl-draw-point-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
      'circle-color': white,
    },
  },
  {
    id: 'gl-draw-point-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': ['case', ['==', ['get', 'active'], 'true'], orange, blue],
    },
  },
  // Vertex handles — enlarged from the defaults (5/7 outer, 3/5 inner) so
  // they're easier to target.
  {
    id: 'gl-draw-vertex-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 13, 10],
      'circle-color': white,
    },
  },
  {
    id: 'gl-draw-vertex-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 8, 6],
      'circle-color': orange,
    },
  },
  // Midpoints (drag to insert a new vertex) — enlarged to match (default 3).
  {
    id: 'gl-draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint']],
    paint: {
      'circle-radius': 6,
      'circle-color': orange,
    },
  },
];
