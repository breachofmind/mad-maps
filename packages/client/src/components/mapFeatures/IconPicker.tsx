import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import { FEATURE_ICON_NAMES, type FeatureIconName } from '../../lib/mapFeatures/icons';
import { MAKI_ICON_CATEGORIES, formatMakiIconLabel, isMakiIconName, type MakiIconName } from '../../lib/mapFeatures/makiIcons';
import { FeatureIconGlyph } from './FeatureIconGlyph';

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
const ALL_CATEGORIES = MAKI_ICON_CATEGORIES;

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');

  const selectedName = isMakiIconName(value) || (FEATURE_ICON_NAMES as readonly string[]).includes(value) ? value : 'marker';

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return ALL_CATEGORIES;
    return ALL_CATEGORIES.map((category) => ({
      ...category,
      names: category.names.filter((name) => formatIconLabel(name).toLowerCase().includes(query)),
    })).filter((category) => category.names.length > 0);
  }, [search]);

  function handleClose() {
    setAnchorEl(null);
    setSearch('');
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
        <Box sx={{ width: 300, p: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder="Search icons"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {filteredCategories.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No icons found
              </Typography>
            ) : (
              filteredCategories.map((category) => (
                <Box key={category.label} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    {category.label}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {category.names.map((name) => {
                      const selected = name === selectedName;
                      return (
                        <Tooltip key={name} title={formatIconLabel(name)}>
                          <IconButton
                            size="small"
                            onClick={() => handleSelect(name)}
                            sx={{
                              border: '1px solid',
                              borderColor: selected ? 'primary.main' : 'transparent',
                              bgcolor: selected ? 'action.selected' : undefined,
                            }}
                          >
                            <FeatureIconGlyph name={name} />
                          </IconButton>
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
