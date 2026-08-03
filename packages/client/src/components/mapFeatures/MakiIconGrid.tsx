import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import { MAKI_ICON_CATEGORIES, formatMakiIconLabel, type MakiIconName } from '../../lib/mapFeatures/makiIcons';
import { FeatureIconGlyph } from './FeatureIconGlyph';

interface MakiIconGridProps {
  selectedName?: string;
  onSelect: (name: MakiIconName) => void;
}

// Searchable grid of every Maki icon, grouped by category — factored out of
// IconPicker so PinPicker (which additionally offers a custom-URL mode) can
// reuse the exact same picking UI instead of duplicating it.
export function MakiIconGrid({ selectedName, onSelect }: MakiIconGridProps) {
  const [search, setSearch] = useState('');

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return MAKI_ICON_CATEGORIES;
    return MAKI_ICON_CATEGORIES.map((category) => ({
      ...category,
      names: category.names.filter((name) => formatMakiIconLabel(name).toLowerCase().includes(query)),
    })).filter((category) => category.names.length > 0);
  }, [search]);

  return (
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
                    <Tooltip key={name} title={formatMakiIconLabel(name)}>
                      <IconButton
                        size="small"
                        onClick={() => onSelect(name)}
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
  );
}
