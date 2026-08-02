// Matches FeatureLayer.tsx's DEFAULT_STROKE_WIDTH and fill-opacity so
// exported KML looks the same as it does in the app.
export const DEFAULT_STROKE_WIDTH = 3;
const POLYGON_FILL_OPACITY = 0.25;

// KML colors are aabbggrr (alpha, blue, green, red), the reverse channel
// order and alpha-first convention from the app's #rrggbb.
export function kmlColor(hexColor: string, opacity = 1): string {
  const hex = hexColor.replace('#', '').padStart(6, '0');
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${alpha}${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`;
}

export function lineStyleId(color: string, strokeWidth: number): string {
  return `line-${color.replace('#', '')}-${strokeWidth}`;
}

export function polygonStyleId(color: string, strokeWidth: number): string {
  return `poly-${color.replace('#', '')}-${strokeWidth}`;
}

function lineStyleBlock(id: string, color: string, strokeWidth: number): string {
  return `<Style id="${id}"><LineStyle><color>${kmlColor(color)}</color><width>${strokeWidth}</width></LineStyle></Style>`;
}

function polygonStyleBlock(id: string, color: string, strokeWidth: number): string {
  return (
    `<Style id="${id}">` +
    `<LineStyle><color>${kmlColor(color)}</color><width>${strokeWidth}</width></LineStyle>` +
    `<PolyStyle><color>${kmlColor(color, POLYGON_FILL_OPACITY)}</color><fill>1</fill><outline>1</outline></PolyStyle>` +
    '</Style>'
  );
}

// Resolves the <Style id="..."> block for a LineString/Polygon feature's
// chosen color + stroke width — Point features are styled separately (icon
// rasterization, KMZ-only; see kmz.service.ts), and other geometry types get
// no custom style.
export function geometryStyle(
  geometryType: string,
  color: string,
  strokeWidth: number,
): { id: string; block: string } | null {
  if (geometryType === 'LineString') {
    const id = lineStyleId(color, strokeWidth);
    return { id, block: lineStyleBlock(id, color, strokeWidth) };
  }
  if (geometryType === 'Polygon') {
    const id = polygonStyleId(color, strokeWidth);
    return { id, block: polygonStyleBlock(id, color, strokeWidth) };
  }
  return null;
}
