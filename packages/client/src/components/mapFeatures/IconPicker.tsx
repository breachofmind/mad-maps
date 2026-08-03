import { useState } from 'react';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import { FEATURE_ICON_NAMES, type FeatureIconName } from '../../lib/mapFeatures/icons';
import { formatMakiIconLabel, isMakiIconName, type MakiIconName } from '../../lib/mapFeatures/makiIcons';
import { FeatureIconGlyph } from './FeatureIconGlyph';
import { MakiIconGrid } from './MakiIconGrid';

interface IconPickerProps {
  value: string;
  onChange: (icon: MakiIconName) => void;
}

const LABEL_OVERRIDES: Partial<Record<FeatureIconName, string>> = {
  atm: 'ATM',
  evStation: 'EV Station',
};

function formatIconLabel(name: string): string {
  if (isMakiIconName(name)) return formatMakiIconLabel(name);
  return LABEL_OVERRIDES[name as FeatureIconName] ?? name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

// Only Maki icons are offered for new selections (see makiIcons.ts) — the
// old MUI set (icons.ts) is kept only so already-saved features/layers with
// an MUI-keyed icon (e.g. "restaurant") keep resolving and rendering
// correctly; formatIconLabel/FeatureIconGlyph below still understand those
// keys for that reason.
export function IconPicker({ value, onChange }: IconPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const selectedName = isMakiIconName(value) || (FEATURE_ICON_NAMES as readonly string[]).includes(value) ? value : 'marker';

  function handleClose() {
    setAnchorEl(null);
  }

  function handleSelect(name: MakiIconName) {
    onChange(name);
    handleClose();
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<FeatureIconGlyph name={selectedName} />}
        sx={{ textTransform: 'none' }}
      >
        {formatIconLabel(selectedName)}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MakiIconGrid selectedName={selectedName} onSelect={handleSelect} />
      </Popover>
    </>
  );
}
