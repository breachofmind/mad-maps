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
import { FEATURE_ICONS, FEATURE_ICON_CATEGORIES, type FeatureIconName } from './icons';

interface IconPickerProps {
  value: string;
  onChange: (icon: FeatureIconName) => void;
}

const LABEL_OVERRIDES: Partial<Record<FeatureIconName, string>> = {
  atm: 'ATM',
  evStation: 'EV Station',
};

function formatIconLabel(name: FeatureIconName): string {
  return LABEL_OVERRIDES[name] ?? name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [search, setSearch] = useState('');

  const selectedName = (value in FEATURE_ICONS ? value : 'marker') as FeatureIconName;
  const SelectedIcon = FEATURE_ICONS[selectedName];

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return FEATURE_ICON_CATEGORIES;
    return FEATURE_ICON_CATEGORIES.map((category) => ({
      ...category,
      names: category.names.filter((name) => formatIconLabel(name).toLowerCase().includes(query)),
    })).filter((category) => category.names.length > 0);
  }, [search]);

  function handleClose() {
    setAnchorEl(null);
    setSearch('');
  }

  function handleSelect(name: FeatureIconName) {
    onChange(name);
    handleClose();
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<SelectedIcon fontSize="small" />}
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
                      const Icon = FEATURE_ICONS[name];
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
                            <Icon fontSize="small" />
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
