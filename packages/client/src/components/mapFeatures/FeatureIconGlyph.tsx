import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { FEATURE_ICONS, type FeatureIconName } from '../../lib/mapFeatures/icons';
import { getMakiIconMarkup } from '../../lib/mapFeatures/makiIcons';

interface FeatureIconGlyphProps {
  name: string;
  color?: string;
  fontSize?: 'small' | 'medium' | 'inherit';
  sx?: SxProps<Theme>;
}

const FONT_SIZE_PX: Record<'small' | 'medium' | 'inherit', number> = { small: 20, medium: 24, inherit: 20 };

// Renders an icon/defaultIcon name regardless of which source it came from —
// the fixed MUI icon set (FEATURE_ICONS) or a vendored Maki SVG
// (packages/client/src/lib/mapFeatures/makiIcons.ts) — so call sites don't
// need to know which. Both are plain strings in the same feature/layer
// fields, distinguished only by the "maki:" prefix.
export function FeatureIconGlyph({ name, color, fontSize = 'small', sx }: FeatureIconGlyphProps) {
  const makiMarkup = getMakiIconMarkup(name);
  if (makiMarkup) {
    const size = FONT_SIZE_PX[fontSize];
    const coloredMarkup = makiMarkup.replace('<svg ', '<svg fill="currentColor" ');
    return (
      <Box
        component="span"
        aria-hidden
        sx={{
          display: 'inline-flex',
          flexShrink: 0,
          width: size,
          height: size,
          color,
          '& svg': { width: '100%', height: '100%' },
          ...sx,
        }}
        dangerouslySetInnerHTML={{ __html: coloredMarkup }}
      />
    );
  }
  const Icon = FEATURE_ICONS[(name in FEATURE_ICONS ? name : 'marker') as FeatureIconName];
  return <Icon fontSize={fontSize} sx={{ color, ...sx }} />;
}
