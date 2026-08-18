import type { LayerStyleConfig } from '@mad-maps/shared';
import { isMakiIconName } from '@mad-maps/shared';
import { externalIconImageId } from './externalIconImages';
import { featureIconImageId } from './featureIconImages';
import { currentIconRules, normalizeStyleConfig } from '../layers/styleConfig';
import { type MapboxExpression, NEVER_FILTER } from './remoteLayerStyleConstants';

// Falls back to the flat layer color unless a numeric colorProperty with two
// valid (ascending) stops is configured, in which case features are
// colorized by interpolating between the low/high stops. `to-number` guards
// against a property that's a string in some features (mixed-quality feeds).
export function buildColorExpression(flatColor: string, styleConfig: LayerStyleConfig | null): string | MapboxExpression {
  const colorProperty = styleConfig?.colorProperty;
  const stops = styleConfig?.colorStops;
  if (!colorProperty || !stops || stops.length < 2) return flatColor;
  const [low, high] = stops;
  if (!(low.value < high.value)) return flatColor;
  return [
    'interpolate',
    ['linear'],
    ['to-number', ['get', colorProperty], 0],
    low.value,
    low.color,
    high.value,
    high.color,
  ];
}

export function labelTextField(labelProperty: string | null | undefined): string | MapboxExpression {
  return labelProperty ? ['to-string', ['get', labelProperty]] : '';
}

// Maki icons are rasterized locally (see featureIconImages.tsx) rather than
// fetched, so unlike a custom URL they can't fail to load — always usable
// once a value is set. A custom-URL rule/default is only usable once
// ensureExternalIconImages has confirmed the url actually loaded.
export function isIconUsable(value: string, loadedIconUrls: ReadonlySet<string>): boolean {
  return isMakiIconName(value) || loadedIconUrls.has(value);
}

// Only rules whose icon is usable (see isIconUsable) apply — a rule
// referencing a url that 404'd or lacks CORS support falls back to the
// default pin (or circle marker) rather than rendering nothing.
export function usableIconRules(styleConfig: LayerStyleConfig | null, loadedIconUrls: ReadonlySet<string>) {
  return currentIconRules(normalizeStyleConfig(styleConfig)).filter(
    (rule) => rule.iconUrl && isIconUsable(rule.iconUrl, loadedIconUrls),
  );
}

export function defaultIconUsable(styleConfig: LayerStyleConfig | null, loadedIconUrls: ReadonlySet<string>): boolean {
  const url = styleConfig?.defaultIconUrl;
  return Boolean(url && isIconUsable(url, loadedIconUrls));
}

// A point renders on the icon layer when either its iconProperty value
// matches one of the usable rules, or — since every point that doesn't
// match a specific rule falls back to the layer's default pin, once one is
// configured and loaded — a default icon is set at all (in which case
// *every* point qualifies, matched or not, and the circle layer beneath is
// left with nothing to draw). Returns null when no icon applies to any
// point, in which case everything renders as the plain circle marker.
export function pointIconFilter(
  styleConfig: LayerStyleConfig | null,
  loadedIconUrls: ReadonlySet<string>,
): MapboxExpression | 'all' | null {
  if (defaultIconUsable(styleConfig, loadedIconUrls)) return 'all';
  const rules = usableIconRules(styleConfig, loadedIconUrls);
  if (rules.length === 0) return null;
  return ['in', ['get', styleConfig!.iconProperty], ['literal', rules.map((r) => r.value)]];
}

// A rule/default value is either a "maki:"-prefixed icon name (rasterized
// via featureIconImageId, tinted with the layer's color like local features)
// or a custom image URL (rasterized as-is via externalIconImageId).
export function iconImageId(value: string, layerColor: string): string {
  return isMakiIconName(value) ? featureIconImageId(value, layerColor) : externalIconImageId(value);
}

export function iconImageExpression(
  layerColor: string,
  styleConfig: LayerStyleConfig | null,
  loadedIconUrls: ReadonlySet<string>,
): string | MapboxExpression {
  const rules = usableIconRules(styleConfig, loadedIconUrls);
  const defaultImageId = defaultIconUsable(styleConfig, loadedIconUrls)
    ? iconImageId(styleConfig!.defaultIconUrl!, layerColor)
    : '';
  if (rules.length === 0) return defaultImageId;
  const match: unknown[] = ['match', ['get', styleConfig!.iconProperty]];
  for (const rule of rules) match.push(rule.value, iconImageId(rule.iconUrl, layerColor));
  match.push(defaultImageId); // unmatched values fall back to the layer's default pin, if any
  return match as MapboxExpression;
}

// The icon layer's own filter: every point when the default pin covers
// unmatched values too, just the matched subset otherwise, or none at all.
export function iconLayerFilter(iconFilter: MapboxExpression | 'all' | null): MapboxExpression {
  const base: MapboxExpression = ['==', ['geometry-type'], 'Point'];
  if (iconFilter === 'all') return base;
  if (iconFilter === null) return NEVER_FILTER;
  return ['all', base, iconFilter];
}

export function pointFilter(iconFilter: MapboxExpression | 'all' | null): MapboxExpression {
  const base: MapboxExpression = ['==', ['geometry-type'], 'Point'];
  if (iconFilter === 'all') return NEVER_FILTER;
  if (iconFilter === null) return base;
  return ['all', base, ['!', iconFilter]];
}
