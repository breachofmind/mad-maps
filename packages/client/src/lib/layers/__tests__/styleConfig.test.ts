import { currentIconRules, normalizeStyleConfig } from '../styleConfig';
import type { LayerStyleConfig } from '@mad-maps/shared';

describe('normalizeStyleConfig', () => {
  it('fills in defaults for null/undefined', () => {
    expect(normalizeStyleConfig(null)).toEqual({
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: null,
      iconRulesByProperty: {},
      defaultIconUrl: null,
    });
    expect(normalizeStyleConfig(undefined)).toEqual(normalizeStyleConfig(null));
  });

  it('passes through an already-current-shape config unchanged', () => {
    const config: LayerStyleConfig = {
      labelProperty: 'temp',
      colorProperty: null,
      colorStops: [],
      iconProperty: 'zone',
      iconRulesByProperty: { zone: [{ value: 'A', iconUrl: 'maki:cafe' }] },
      defaultIconUrl: null,
    };
    expect(normalizeStyleConfig(config)).toEqual(config);
  });

  it('migrates a legacy flat iconRules array into iconRulesByProperty under the active property', () => {
    const legacy = {
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: 'cover',
      iconRules: [{ value: 'CLR', iconUrl: 'https://example.com/sun.png' }],
      defaultIconUrl: null,
    };
    const result = normalizeStyleConfig(legacy);
    expect(result.iconRulesByProperty).toEqual({
      cover: [{ value: 'CLR', iconUrl: 'https://example.com/sun.png' }],
    });
    expect(result).not.toHaveProperty('iconRules');
  });

  it('does not migrate legacy iconRules when no property is active', () => {
    const legacy = {
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: null,
      iconRules: [{ value: 'CLR', iconUrl: 'https://example.com/sun.png' }],
      defaultIconUrl: null,
    };
    expect(normalizeStyleConfig(legacy).iconRulesByProperty).toEqual({});
  });

  it('does not overwrite an existing iconRulesByProperty entry with legacy data', () => {
    const mixed = {
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: 'cover',
      iconRules: [{ value: 'STALE', iconUrl: 'https://example.com/old.png' }],
      iconRulesByProperty: { cover: [{ value: 'FRESH', iconUrl: 'https://example.com/new.png' }] },
      defaultIconUrl: null,
    };
    expect(normalizeStyleConfig(mixed).iconRulesByProperty).toEqual({
      cover: [{ value: 'FRESH', iconUrl: 'https://example.com/new.png' }],
    });
  });
});

describe('currentIconRules', () => {
  it('returns [] when no property is active', () => {
    expect(currentIconRules(normalizeStyleConfig(null))).toEqual([]);
  });

  it('returns the rules for the active property, ignoring other stored properties', () => {
    const config: LayerStyleConfig = {
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: 'zone',
      iconRulesByProperty: {
        zone: [{ value: 'A', iconUrl: 'maki:cafe' }],
        technology: [{ value: 'X', iconUrl: 'maki:restaurant' }],
      },
      defaultIconUrl: null,
    };
    expect(currentIconRules(config)).toEqual([{ value: 'A', iconUrl: 'maki:cafe' }]);
  });

  it('returns [] for an active property with no stored rules yet', () => {
    const config: LayerStyleConfig = {
      labelProperty: null,
      colorProperty: null,
      colorStops: [],
      iconProperty: 'zone',
      iconRulesByProperty: {},
      defaultIconUrl: null,
    };
    expect(currentIconRules(config)).toEqual([]);
  });
});
