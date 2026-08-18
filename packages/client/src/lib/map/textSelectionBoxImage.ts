// Raster used as the hover/selection indicator behind a text feature (see
// LAYER_IDS.textHover in featureLayerIds.ts) — a small rounded-rect stroke,
// registered once per style as an SDF image (so its color can be tinted at
// render time via icon-color, matching pointHover/geometryHover's
// contrast-sampled highlight color) and stretched via icon-text-fit to wrap
// whatever text it's paired with, in place of the circular ring points get.
export const TEXT_SELECTION_BOX_IMAGE_ID = 'mad-maps-text-selection-box';
export const TEXT_SELECTION_BOX_SIZE = 24;
export const TEXT_SELECTION_BOX_RADIUS = 6;
export const TEXT_SELECTION_BOX_STROKE = 2;
// Inset far enough from the edge that the rounded corner is never part of
// the stretched middle strip — used for both the 9-slice content region and
// stretchX/stretchY, so the corners stay crisp at any box size.
export const TEXT_SELECTION_BOX_INSET = TEXT_SELECTION_BOX_RADIUS + TEXT_SELECTION_BOX_STROKE;

export function createTextSelectionBoxImage(): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = TEXT_SELECTION_BOX_SIZE;
  canvas.height = TEXT_SELECTION_BOX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = TEXT_SELECTION_BOX_STROKE;
  const inset = TEXT_SELECTION_BOX_STROKE / 2;
  ctx.beginPath();
  ctx.roundRect(
    inset,
    inset,
    TEXT_SELECTION_BOX_SIZE - inset * 2,
    TEXT_SELECTION_BOX_SIZE - inset * 2,
    TEXT_SELECTION_BOX_RADIUS,
  );
  ctx.stroke();
  return ctx.getImageData(0, 0, TEXT_SELECTION_BOX_SIZE, TEXT_SELECTION_BOX_SIZE);
}
