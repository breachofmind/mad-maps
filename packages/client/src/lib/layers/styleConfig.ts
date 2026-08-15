import type { LayerIconRule, LayerStyleConfig } from '@mad-maps/shared';

export const EMPTY_STYLE_CONFIG: LayerStyleConfig = {
  labelProperty: null,
  colorProperty: null,
  colorStops: [],
  iconProperty: null,
  iconRulesByProperty: {},
  defaultIconUrl: null,
};

// styleConfig is stored in an unvalidated JSONB column (see
// db/schema.ts), so a layer saved before iconRulesByProperty existed may
// still have the old shape: a flat `iconRules` array for whichever
// iconProperty was active at the time.
interface LegacyStyleConfigShape {
  iconRules?: LayerIconRule[];
}

// Normalizes a layer's raw styleConfig into the current shape, folding a
// legacy flat `iconRules` array into iconRulesByProperty under whatever
// iconProperty was active — so layers saved before iconRulesByProperty
// existed don't silently lose their icon-by-value mappings the first time
// they're read post-upgrade.
export function normalizeStyleConfig(
  raw: (Partial<LayerStyleConfig> & LegacyStyleConfigShape) | null | undefined,
): LayerStyleConfig {
  const merged: LayerStyleConfig & LegacyStyleConfigShape = { ...EMPTY_STYLE_CONFIG, ...(raw ?? {}) };
  if (merged.iconRules && merged.iconProperty && !merged.iconRulesByProperty[merged.iconProperty]) {
    merged.iconRulesByProperty = { ...merged.iconRulesByProperty, [merged.iconProperty]: merged.iconRules };
  }
  const { iconRules: _legacy, ...rest } = merged;
  return rest;
}

// The icon-by-value rules for whichever property is currently active —
// other properties' rules stay saved in iconRulesByProperty but aren't
// rendered/edited until the user switches back to them.
export function currentIconRules(styleConfig: LayerStyleConfig): LayerIconRule[] {
  return styleConfig.iconProperty ? (styleConfig.iconRulesByProperty[styleConfig.iconProperty] ?? []) : [];
}
