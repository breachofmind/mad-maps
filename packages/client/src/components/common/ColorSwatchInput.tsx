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
  '&::-webkit-color-swatch-wrapper': { p: 0 },
  '&::-webkit-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
  '&::-moz-color-swatch': { border: '1px solid rgba(0,0,0,0.3)', borderRadius: '50%' },
};

// Full-width button showing its own current color, for the properties-panel
// color picker (matches Figma's ColorSwatchPicker) rather than a small
// circular swatch alongside other controls.
const CHIP_SX = {
  display: 'block',
  width: '100%',
  height: 31,
  p: 0,
  border: 'none',
  borderRadius: 1,
  cursor: 'pointer',
  '&::-webkit-color-swatch-wrapper': { p: 0 },
  '&::-webkit-color-swatch': { border: 'none', borderRadius: 'inherit' },
  '&::-moz-color-swatch': { border: 'none', borderRadius: 'inherit' },
};

interface ColorSwatchInputProps {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  variant?: 'circle' | 'chip';
}

export function ColorSwatchInput({ value, onChange, ariaLabel, variant = 'circle' }: ColorSwatchInputProps) {
  const input = (
    <Box
      component="input"
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      sx={variant === 'chip' ? CHIP_SX : CIRCLE_SX}
    />
  );

  if (variant !== 'chip') return input;

  return (
    <Box sx={{ position: 'relative' }}>
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
