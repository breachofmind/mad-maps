import { MAKI_ICON_SVGS } from './makiIconSvgs.generated';

// Namespaced so a Maki key can never collide with an existing MUI-based
// FeatureIconName (packages/client/src/lib/mapFeatures/icons.ts) — both are
// valid values of the same plain-string icon/defaultIcon fields.
const MAKI_PREFIX = 'maki:';

export type MakiIconName = `maki:${string}`;

export function isMakiIconName(name: string): name is MakiIconName {
  return name.startsWith(MAKI_PREFIX) && name.slice(MAKI_PREFIX.length) in MAKI_ICON_SVGS;
}

export function makiIconKey(baseName: string): MakiIconName {
  return `${MAKI_PREFIX}${baseName}`;
}

// Raw <svg>...</svg> markup (viewBox 0 0 15 15, no fill set on the path) for
// a Maki icon name — accepts either the bare Maki name ("restaurant") or the
// namespaced key ("maki:restaurant").
export function getMakiIconMarkup(name: string): string | undefined {
  const baseName = name.startsWith(MAKI_PREFIX) ? name.slice(MAKI_PREFIX.length) : name;
  return MAKI_ICON_SVGS[baseName];
}

export const MAKI_ICON_NAMES: MakiIconName[] = Object.keys(MAKI_ICON_SVGS).sort().map(makiIconKey);
