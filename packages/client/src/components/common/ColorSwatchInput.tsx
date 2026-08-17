import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const CIRCLE_SX = {
  width: 32,
  height: 32,
  p: 0,
  border: 'none',
  borderRadius: '50%',
  overflow: 'hidden',
  cursor: 'pointer',
  // outline rather than border: a native color input appears to always
  // paint an explicit border, even a transparent one, which ruled out
  // fading border-color in from a transparent idle state. outline-color
  // fades cleanly since outline-style stays 'solid' throughout.
  outline: '1px solid transparent',
  transition: 'outline-color 150ms ease-in-out',
  '&:hover': { outlineColor: '#fff' },
  '&::-webkit-color-swatch-wrapper': { p: 0 },
  '&::-webkit-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
  '&::-moz-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
};

// Button showing its own current color with its hex value overlaid
// (matches Figma's ColorSwatchPicker) rather than a small circular swatch
// alongside other controls. Defaults to filling its container (the
// properties-panel color picker); pass a fixed `width` for a smaller inline
// chip, e.g. a gradient stop row's color — Figma sizes those at 65px.
const CHIP_SX = {
  display: 'block',
  height: 31,
  p: 0,
  border: 'none',
  borderRadius: 1,
  cursor: 'pointer',
  outline: '1px solid transparent',
  transition: 'outline-color 150ms ease-in-out',
  '&:hover': { outlineColor: '#fff' },
  '&::-webkit-color-swatch-wrapper': { p: 0 },
  '&::-webkit-color-swatch': { border: 'none', borderRadius: 'inherit' },
  '&::-moz-color-swatch': { border: 'none', borderRadius: 'inherit' },
};

interface ColorSwatchInputProps {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  variant?: 'circle' | 'chip';
  width?: number | string;
}

export function ColorSwatchInput({
  value,
  onChange,
  ariaLabel,
  variant = 'circle',
  width = '100%',
}: ColorSwatchInputProps) {
  const input = (
    <Box
      component="input"
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      sx={variant === 'chip' ? { ...CHIP_SX, width } : CIRCLE_SX}
    />
  );

  if (variant !== 'chip') return input;

  return (
    <Box sx={{ position: 'relative', width, flexShrink: 0 }}>
      {input}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'common.white',
          fontWeight: 700,
          pointerEvents: 'none',
        }}
      >
        {value.toUpperCase()}
      </Typography>
    </Box>
  );
}
