import { useState } from 'react';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import { FEATURE_ICON_NAMES, type FeatureIconName } from '../../lib/mapFeatures/icons';
import { formatMakiIconLabel, isMakiIconName, type MakiIconName } from '../../lib/mapFeatures/makiIcons';
import { FeatureIconGlyph } from './FeatureIconGlyph';
import { MakiIconGrid } from './MakiIconGrid';

interface IconPickerProps {
  value: string;
  onChange: (icon: MakiIconName) => void;
  // Trigger is just the glyph in an IconButton (no outline/label) — for
  // compositing into a denser control, e.g. FeaturePropertiesPanel's
  // icon+title pill, rather than standing alone.
  iconOnly?: boolean;
  // Tints the trigger glyph to match the feature/layer's own color, e.g.
  // FeaturePropertiesPanel passes the selected pin's color so the icon next
  // to the title reflects it. Left unset (inherits default) elsewhere.
  color?: string;
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
export function IconPicker({ value, onChange, iconOnly = false, color }: IconPickerProps) {
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
      {iconOnly ? (
        <Tooltip title={`Change icon (${formatIconLabel(selectedName)})`}>
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label={`Change icon (${formatIconLabel(selectedName)})`}
          >
            <FeatureIconGlyph name={selectedName} color={color} />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          size="small"
          variant="outlined"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          startIcon={<FeatureIconGlyph name={selectedName} color={color} />}
          sx={{ textTransform: 'none' }}
        >
          {formatIconLabel(selectedName)}
        </Button>
      )}
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
