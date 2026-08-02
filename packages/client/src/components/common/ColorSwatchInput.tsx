import Box from '@mui/material/Box';

const COLOR_SWATCH_SX = {
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

interface ColorSwatchInputProps {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
}

export function ColorSwatchInput({ value, onChange, ariaLabel }: ColorSwatchInputProps) {
  return (
    <Box
      component="input"
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      sx={COLOR_SWATCH_SX}
    />
  );
}
