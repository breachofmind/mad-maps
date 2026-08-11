import { MAKI_ICON_NAMES, type MakiIconName } from '@mad-maps/shared';

export { isMakiIconName, makiIconKey, getMakiIconMarkup, MAKI_ICON_NAMES, type MakiIconName } from '@mad-maps/shared';

export interface FeatureIconCategory {
  label: string;
  names: MakiIconName[];
}

// Maki ships no bundled category metadata (unlike some older releases), so
// icons are grouped here by keyword match against their base name. Order
// matters: first matching bucket wins. Anything left over falls into "More".
const CATEGORY_KEYWORDS: { label: string; keywords: string[] }[] = [
  {
    label: 'Food & Drink',
    keywords: ['restaurant', 'cafe', 'bar', 'bakery', 'bbq', 'beer', 'alcohol-shop', 'fast-food', 'ice-cream', 'confectionery', 'teahouse'],
  },
  {
    label: 'Transportation',
    keywords: [
      'aerialway', 'airfield', 'airport', 'bicycle', 'bus', 'car', 'ferry', 'fuel', 'harbor', 'heliport',
      'parking', 'rail', 'scooter', 'taxi', 'terminal', 'toll', 'charging-station', 'racetrack',
      'road-accident', 'roadblock', 'slipway', 'snowmobile', 'tunnel', 'bridge', 'suitcase',
    ],
  },
  {
    label: 'Nature & Recreation',
    keywords: [
      'amusement-park', 'aquarium', 'beach', 'campsite', 'dog-park', 'farm', 'garden', 'golf', 'mountain',
      'natural', 'park', 'picnic-site', 'playground', 'ranger-station', 'viewpoint', 'volcano', 'waterfall',
      'watermill', 'wetland', 'windmill', 'zoo', 'hot-spring',
    ],
  },
  {
    label: 'Sports',
    keywords: [
      'american-football', 'baseball', 'basketball', 'bowling-alley', 'cricket', 'fitness-centre', 'gaming',
      'karaoke', 'pitch', 'skateboard', 'skiing', 'soccer', 'stadium', 'swimming', 'table-tennis', 'tennis',
      'volleyball', 'horse-riding',
    ],
  },
  {
    label: 'Buildings & Places',
    keywords: [
      'bank', 'building', 'casino', 'castle', 'cinema', 'city', 'college', 'commercial', 'embassy', 'factory',
      'hospital', 'lodging', 'landmark', 'library', 'monument', 'museum', 'prison', 'residential-community',
      'school', 'slaughterhouse', 'theatre', 'town', 'village', 'warehouse', 'industry',
    ],
  },
  {
    label: 'Religious & Historic',
    keywords: ['cemetery', 'place-of-worship', 'religious', 'marae', 'historic'],
  },
  {
    label: 'Shops & Services',
    keywords: [
      'shop', 'clothing-store', 'jewelry-store', 'convenience', 'furniture', 'gift', 'hairdresser', 'laundry',
      'garden-centre', 'hardware', 'optician', 'recycling', 'watch', 'shoe', 'paint', 'grocery',
    ],
  },
  {
    label: 'Safety & Utilities',
    keywords: [
      'animal-shelter', 'barrier', 'caution', 'cross', 'danger', 'defibrillator', 'doctor', 'dentist',
      'drinking-water', 'elevator', 'emergency-phone', 'entrance', 'fence', 'fire-station', 'gate', 'lift-gate',
      'police', 'post', 'shelter', 'telephone', 'toilet', 'veterinary', 'waste-basket', 'water', 'wheelchair',
      'communications-tower', 'logging', 'mobile-phone',
    ],
  },
  {
    label: 'Symbols & Shapes',
    keywords: [
      'arrow', 'circle', 'diamond', 'globe', 'heart', 'marker', 'square', 'star', 'triangle', 'information',
      'rocket', 'music', 'attraction',
    ],
  },
];

// Matches by '-'-delimited token subsequence rather than raw substring, so
// e.g. the "bar" keyword doesn't accidentally match "barrier".
function nameMatchesKeyword(baseName: string, keyword: string): boolean {
  const tokens = baseName.split('-');
  const keywordTokens = keyword.split('-');
  for (let i = 0; i + keywordTokens.length <= tokens.length; i++) {
    if (keywordTokens.every((token, j) => tokens[i + j] === token)) return true;
  }
  return false;
}

function formatMakiLabel(baseName: string): string {
  return baseName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatMakiIconLabel(name: MakiIconName): string {
  return formatMakiLabel(name.slice('maki:'.length));
}

export const MAKI_ICON_CATEGORIES: FeatureIconCategory[] = (() => {
  const buckets = new Map<string, MakiIconName[]>(CATEGORY_KEYWORDS.map(({ label }) => [label, []]));
  const more: MakiIconName[] = [];

  for (const name of MAKI_ICON_NAMES) {
    const baseName = name.slice('maki:'.length);
    const bucket = CATEGORY_KEYWORDS.find(({ keywords }) => keywords.some((keyword) => nameMatchesKeyword(baseName, keyword)));
    (bucket ? buckets.get(bucket.label)! : more).push(name);
  }

  const categories = CATEGORY_KEYWORDS.map(({ label }) => ({ label, names: buckets.get(label)! })).filter(
    (category) => category.names.length > 0,
  );
  if (more.length > 0) categories.push({ label: 'More', names: more });
  return categories;
})();
