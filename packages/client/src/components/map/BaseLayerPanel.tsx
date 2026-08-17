import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import AddIcon from '@mui/icons-material/Add';
import { MAP_STYLE_OPTIONS } from '../../lib/map/mapStyles';

interface BaseLayerPanelProps {
  activeStyleId: string;
  onChange: (styleId: string) => void;
  onAddCustomStyle: () => void;
}

// SideBar section replacing the old floating StyleSwitcher toggle group.
// activeStyleId is '' when map.baseStyle is a custom URL that doesn't match
// any preset — the dropdown then shows "Custom style" via renderValue rather
// than a blank/selected-looking box.
export function BaseLayerPanel({ activeStyleId, onChange, onAddCustomStyle }: BaseLayerPanelProps) {
  const activeOption = MAP_STYLE_OPTIONS.find((option) => option.id === activeStyleId);

  function handleChange(e: SelectChangeEvent) {
    onChange(e.target.value);
  }

  return (
    <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2">Base Layer</Typography>
        <Tooltip title="Add a custom base style">
          <IconButton size="small" onClick={onAddCustomStyle} aria-label="Add a custom base style">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <FormControl size="small" fullWidth>
        <Select
          value={activeStyleId}
          displayEmpty
          onChange={handleChange}
          renderValue={() => activeOption?.label ?? 'Custom style'}
          sx={{
            bgcolor: '#1a1c1b',
            borderRadius: 1,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
          }}
        >
          {MAP_STYLE_OPTIONS.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
