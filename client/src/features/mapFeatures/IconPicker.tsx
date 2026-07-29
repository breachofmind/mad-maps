import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { FEATURE_ICONS, FEATURE_ICON_NAMES, type FeatureIconName } from './icons';

interface IconPickerProps {
  value: string;
  onChange: (icon: FeatureIconName) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={(_e, next: FeatureIconName | null) => {
        if (next) onChange(next);
      }}
      sx={{ flexWrap: 'wrap' }}
    >
      {FEATURE_ICON_NAMES.map((name) => {
        const Icon = FEATURE_ICONS[name];
        return (
          <ToggleButton key={name} value={name} aria-label={name}>
            <Icon fontSize="small" />
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
