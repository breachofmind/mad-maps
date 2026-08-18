import type { LineStyle } from '@mad-maps/shared';
import { DEFAULT_HIGHLIGHT_COLOR } from './basemapContrast';

export const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
// Stable reference for the "no selection" case — returning a fresh `[]`
// literal from a Zustand selector would make every snapshot look like a
// change to useSyncExternalStore, causing an infinite render loop ("Maximum
// update depth exceeded").
export const EMPTY_FEATURE_IDS: string[] = [];

export const POINT_ICON_SIZE = 0.4;
export const DEFAULT_TEXT_FONT_SIZE = 16;
export const POINT_HOVER_RADIUS = 18;
export const POINT_HOVER_STROKE_WIDTH = 5;
export const GEOMETRY_HOVER_WIDTH = 11;
// Placeholder used only until the contrast-sampling effect (see
// useBasemapContrastColor.ts) picks a color for the actual rendered basemap.
export const DEFAULT_HOVER_COLOR = DEFAULT_HIGHLIGHT_COLOR;
export const POINT_HOVER_OPACITY = 0.3;
export const DEFAULT_STROKE_WIDTH = 3;
export const LINE_HIT_AREA_PADDING = 18;
export const HIGHLIGHT_FADE_DURATION_MS = 200;
export const HOVER_LABEL_TEXT_SIZE = 12;
// Lifts the label clear of the point icon it's labeling — text offset is in
// ems, so negative-y moves it up regardless of text-size.
export const HOVER_LABEL_OFFSET_EM = -1.8;
// Nudges the cursor-following label down-right of the pointer (paired with
// a top-left text-anchor) rather than centering it on the cursor, where it'd
// overlap the pointer icon and whatever's directly under it.
export const CURSOR_LABEL_OFFSET_EM: [number, number] = [1.1, 0.8];

// mapbox-gl-draw registers each theme layer under both a "hot" (actively
// changing) and "cold" (static) source, appending that suffix to the style
// id — see drawTheme.ts / mapbox-gl-draw's options.js addSources(). These
// are the vertex-handle layers from that theme, queried by
// useFeatureLayerMapSync so hovering a control point can get a real pointer
// cursor: Draw's own CSS for this (`.feature-vertex.mouse-move`) references
// a `feature-vertex` class that, in the installed version, no mode ever
// actually applies — so it never matches, and the effective cursor
// otherwise falls back to a generic "move" state that only kicks in after a
// vertex has been dragged once.
export const DRAW_VERTEX_LAYER_IDS = ['gl-draw-vertex-inner.hot', 'gl-draw-vertex-inner.cold'];

// mapbox's line-dasharray only accepts a fixed array per-feature (no
// omitting it for "solid"), so a solid line is represented as one long dash
// with no gap — the standard workaround for mixing dash styles within a
// single data-driven layer.
export const LINE_DASH_ARRAYS: Record<LineStyle, number[]> = {
  solid: [1, 0],
  dashed: [3, 2],
  dotted: [0, 2],
};
