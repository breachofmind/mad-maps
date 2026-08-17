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
import type { BaseStyle } from '@mad-maps/shared';
import { baseStyleKey, MAP_STYLE_OPTIONS } from '../../lib/map/mapStyles';
import { fetchMapStyles, mapStylesQueryKey } from '../../lib/mapStyles/api';
import { PanelHeader } from '../common/Panel';
import { usePanelStore } from '../../lib/state/panelStore';

interface BaseLayerPanelProps {
  activeStyle: BaseStyle;
  onChange: (style: BaseStyle) => void;
  onManageStyles: () => void;
}

// SideBar section replacing the old floating StyleSwitcher toggle group.
// Selection is keyed by baseStyleKey(style) rather than a preset-only id so the
// dropdown can list both the built-in presets and the user's saved custom
// styles (managed on the separate /map-styles page) in one list.
export function BaseLayerPanel({ activeStyle, onChange, onManageStyles }: BaseLayerPanelProps) {
  const collapsed = usePanelStore((s) => s.collapsed.baseLayer);
  const setCollapsed = usePanelStore((s) => s.setCollapsed);
  const { data: customStyles } = useQuery({ queryKey: mapStylesQueryKey(), queryFn: fetchMapStyles });

  const activeKey = baseStyleKey(activeStyle);
  const presetOption = MAP_STYLE_OPTIONS.find((option) => baseStyleKey(option.style) === activeKey);
  const customOption = customStyles?.find((style) => baseStyleKey(style.styleUrl) === activeKey);
  // Falls back to "Custom style" when activeStyle doesn't match any known
  // preset or saved style (e.g. the saved style it once pointed to was deleted).
  const activeLabel = presetOption?.label ?? customOption?.name ?? 'Custom style';

  const stylesByKey = new Map<string, BaseStyle>();
  for (const option of MAP_STYLE_OPTIONS) stylesByKey.set(baseStyleKey(option.style), option.style);
  for (const style of customStyles ?? []) stylesByKey.set(baseStyleKey(style.styleUrl), style.styleUrl);

  function handleChange(e: SelectChangeEvent) {
    const style = stylesByKey.get(e.target.value);
    if (style !== undefined) onChange(style);
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      <PanelHeader
        title="Base Layer"
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed('baseLayer', !collapsed)}
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
              value={activeKey}
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
                <MenuItem key={option.id} value={baseStyleKey(option.style)}>
                  {option.label}
                </MenuItem>
              ))}
              {customStyles && customStyles.length > 0 && <Divider />}
              {customStyles?.map((style) => (
                <MenuItem key={style.id} value={baseStyleKey(style.styleUrl)}>
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
