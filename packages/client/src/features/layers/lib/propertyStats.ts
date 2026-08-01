const SAMPLE_SIZE = 200;

export interface PropertyStats {
  all: string[];
  numeric: string[];
}

// Scans a sample of features (GeoJSON property shape can vary feature to
// feature, e.g. across a paginated API) to build the set of property keys
// worth offering in a "pick a property" dropdown, split into all keys vs.
// ones safe to use in a numeric gradient (every sampled non-null value for
// that key must be a finite number).
export function collectPropertyStats(data: GeoJSON.FeatureCollection | undefined): PropertyStats {
  if (!data) return { all: [], numeric: [] };

  const allKeys = new Set<string>();
  const numericKeys = new Set<string>();
  const disqualified = new Set<string>();

  for (const feature of data.features.slice(0, SAMPLE_SIZE)) {
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      allKeys.add(key);
      if (value === null || value === undefined) continue;
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (!disqualified.has(key)) numericKeys.add(key);
      } else {
        disqualified.add(key);
        numericKeys.delete(key);
      }
    }
  }

  return { all: [...allKeys].sort(), numeric: [...numericKeys].sort() };
}

const DISTINCT_VALUES_LIMIT = 50;

// Distinct string values observed for a property, used to populate the
// "add a value" picker for icon-by-value rules. Capped since a
// high-cardinality (e.g. near-continuous numeric) property would otherwise
// dump an unusably long list — such a property just isn't a good fit for
// per-value icon mapping.
export function collectDistinctValues(
  data: GeoJSON.FeatureCollection | undefined,
  property: string,
  limit = DISTINCT_VALUES_LIMIT,
): string[] {
  if (!data) return [];

  const values = new Set<string>();
  for (const feature of data.features) {
    const value = feature.properties?.[property];
    if (value === null || value === undefined) continue;
    values.add(String(value));
    if (values.size >= limit) break;
  }
  return [...values].sort();
}

export interface NumericRange {
  min: number;
  max: number;
}

export function numericRange(data: GeoJSON.FeatureCollection | undefined, property: string): NumericRange | null {
  if (!data) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const feature of data.features) {
    const value = feature.properties?.[property];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}
