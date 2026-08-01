import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Paper from '@mui/material/Paper';
import { MAP_STYLE_OPTIONS } from '../lib/mapStyles';

interface StyleSwitcherProps {
  activeStyleId: string;
  onChange: (styleId: string) => void;
}

export function StyleSwitcher({ activeStyleId, onChange }: StyleSwitcherProps) {
  return (
    <Paper
      elevation={3}
      sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1, p: 0.5 }}
    >
      <ToggleButtonGroup
        value={activeStyleId}
        exclusive
        size="small"
        onChange={(_e, value: string | null) => {
          if (value) onChange(value);
        }}
      >
        {MAP_STYLE_OPTIONS.map((option) => (
          <ToggleButton key={option.id} value={option.id}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Paper>
  );
}
