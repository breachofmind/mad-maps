import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import NearMeIcon from '@mui/icons-material/NearMe';
import PlaceIcon from '@mui/icons-material/Place';
import TimelineIcon from '@mui/icons-material/Timeline';
import PentagonIcon from '@mui/icons-material/Pentagon';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useEditorStore, type DrawMode } from '../../../state/editorStore';
import type { DrawToolMode } from '../lib/useMapboxDraw';

// 'route' has no mapbox-gl-draw equivalent — it's handled by useMapboxRoute
// instead, so selecting it just deselects whatever Draw mode was active.
const MODE_TO_DRAW_MODE: Record<DrawMode, DrawToolMode> = {
  none: 'simple_select',
  point: 'draw_point',
  line: 'draw_line_string',
  polygon: 'draw_polygon',
  route: 'simple_select',
};

export const DRAW_MODE_TO_EDITOR_MODE: Record<DrawToolMode, DrawMode> = {
  simple_select: 'none',
  draw_point: 'point',
  draw_line_string: 'line',
  draw_polygon: 'polygon',
};

interface DrawControlsProps {
  setMode: (mode: DrawToolMode) => void;
  disabled?: boolean;
}

export function DrawControls({ setMode, disabled }: DrawControlsProps) {
  const drawMode = useEditorStore((s) => s.drawMode);
  const setDrawMode = useEditorStore((s) => s.setDrawMode);

  function handleChange(_e: unknown, value: DrawMode | null) {
    if (!value) return;
    setDrawMode(value);
    setMode(MODE_TO_DRAW_MODE[value]);
  }

  return (
    <Paper elevation={3} sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1, p: 0.5 }}>
      <ToggleButtonGroup value={drawMode} exclusive size="small" onChange={handleChange} disabled={disabled}>
        <Tooltip title="Select">
          <ToggleButton value="none" aria-label="Select">
            <NearMeIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Draw point">
          <ToggleButton value="point" aria-label="Draw point">
            <PlaceIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Draw line">
          <ToggleButton value="line" aria-label="Draw line">
            <TimelineIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Draw polygon">
          <ToggleButton value="polygon" aria-label="Draw polygon">
            <PentagonIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
        <Tooltip title="Route along roads/trails">
          <ToggleButton value="route" aria-label="Route along roads/trails">
            <AltRouteIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Paper>
  );
}
