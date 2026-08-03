import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { FEATURE_COLORS, normalizeHexColor } from '../../lib/mapFeatures/colors';
import { ColorSwatchInput } from '../common/ColorSwatchInput';

export function MeasurementStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

export function UnitSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <FormControl size="small" variant="standard" sx={{ minWidth: 130 }}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

interface ColorSwatchRowProps {
  // The color to ring-highlight and seed the hex field from. Pass null for a
  // mixed multi-selection where no single "current" color exists — no swatch
  // gets the ring, and the hex field starts blank.
  value: string | null;
  onSelect: (color: string) => void;
}

export function ColorSwatchRow({ value, onSelect }: ColorSwatchRowProps) {
  const [colorText, setColorText] = useState(value ?? '');

  function selectColor(color: string) {
    setColorText(color);
    onSelect(color);
  }

  function commitColorText() {
    const normalized = normalizeHexColor(colorText);
    if (normalized) {
      selectColor(normalized);
    } else {
      setColorText(value ?? '');
    }
  }

  const customColorValue = normalizeHexColor(colorText) ?? value ?? FEATURE_COLORS[0];

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      {FEATURE_COLORS.map((color) => (
        <Box
          key={color}
          onClick={() => selectColor(color)}
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: color,
            cursor: 'pointer',
            border: value === color ? '2px solid black' : '2px solid transparent',
          }}
        />
      ))}
      <Tooltip title="Custom color">
        <span>
          <ColorSwatchInput value={customColorValue} onChange={selectColor} ariaLabel="Custom color" />
        </span>
      </Tooltip>
      <TextField
        size="small"
        variant="standard"
        value={colorText}
        onChange={(e) => setColorText(e.target.value)}
        onBlur={commitColorText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitColorText();
        }}
        sx={{ width: 84, mt: 1 }}
        inputProps={{ 'aria-label': 'Custom color hex value' }}
      />
    </Stack>
  );
}
