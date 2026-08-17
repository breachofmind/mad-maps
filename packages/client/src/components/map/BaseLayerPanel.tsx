import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormControl from '@mui/material/FormControl';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import { MAP_STYLE_OPTIONS } from '../../lib/map/mapStyles';
import { fetchMapStyles, mapStylesQueryKey } from '../../lib/mapStyles/api';
import { PanelHeader } from '../common/Panel';

interface BaseLayerPanelProps {
  activeStyleUrl: string;
  onChange: (styleUrl: string) => void;
  onManageStyles: () => void;
}

// SideBar section replacing the old floating StyleSwitcher toggle group.
// Selection is now keyed by styleUrl directly (rather than a preset-only id)
// so the dropdown can list both the built-in presets and the user's saved
// custom styles (managed on the separate /map-styles page) in one list.
export function BaseLayerPanel({ activeStyleUrl, onChange, onManageStyles }: BaseLayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: customStyles } = useQuery({ queryKey: mapStylesQueryKey(), queryFn: fetchMapStyles });

  const presetOption = MAP_STYLE_OPTIONS.find((option) => option.styleUrl === activeStyleUrl);
  const customOption = customStyles?.find((style) => style.styleUrl === activeStyleUrl);
  // Falls back to "Custom style" when activeStyleUrl doesn't match any known
  // preset or saved style (e.g. the saved style it once pointed to was deleted).
  const activeLabel = presetOption?.label ?? customOption?.name ?? 'Custom style';

  function handleChange(e: SelectChangeEvent) {
    onChange(e.target.value);
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      <PanelHeader
        title="Base Layer"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        collapseLabel="Base Layer"
        actions={
          <Tooltip title="Manage map styles">
            <IconButton size="small" onClick={onManageStyles} aria-label="Manage map styles">
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      <Collapse in={!collapsed}>
        <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
          <FormControl size="small" fullWidth>
            <Select
              value={activeStyleUrl}
              displayEmpty
              onChange={handleChange}
              renderValue={() => activeLabel}
              sx={{
                bgcolor: '#1a1c1b',
                borderRadius: 1,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
              }}
            >
              {MAP_STYLE_OPTIONS.map((option) => (
                <MenuItem key={option.id} value={option.styleUrl}>
                  {option.label}
                </MenuItem>
              ))}
              {customStyles && customStyles.length > 0 && <Divider />}
              {customStyles?.map((style) => (
                <MenuItem key={style.id} value={style.styleUrl}>
                  {style.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Collapse>
    </Box>
  );
}
