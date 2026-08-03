import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useUnitsStore } from '../../lib/state/unitsStore';
import { formatDistance } from '../../lib/mapFeatures/geometryMeasurements';
import { formatDuration, type RouteProfile } from '../../lib/draw/mapboxDirections';

interface RouteControlsProps {
  profile: RouteProfile;
  onProfileChange: (profile: RouteProfile) => void;
  waypointCount: number;
  isFetching: boolean;
  distanceMeters: number | null;
  durationSeconds: number | null;
  error: string | null;
  onFinish: () => void;
  onCancel: () => void;
}

export function RouteControls({
  profile,
  onProfileChange,
  waypointCount,
  isFetching,
  distanceMeters,
  durationSeconds,
  error,
  onFinish,
  onCancel,
}: RouteControlsProps) {
  const distanceUnit = useUnitsStore((s) => s.distanceUnit);

  let status = 'Click the map to start a route';
  if (isFetching) status = 'Snapping to roads/trails…';
  else if (error) status = error;
  else if (distanceMeters !== null) {
    status = formatDistance(distanceMeters, distanceUnit);
    if (durationSeconds !== null) status += ` · ${formatDuration(durationSeconds)}`;
  } else if (waypointCount > 0) status = 'Click to add another point';

  return (
    <Paper
      elevation={3}
      sx={{ position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 1, p: 1 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <ToggleButtonGroup
          value={profile}
          exclusive
          size="small"
          onChange={(_e, value: RouteProfile | null) => value && onProfileChange(value)}
        >
          <Tooltip title="Walking / hiking">
            <ToggleButton value="walking" aria-label="Walking">
              <DirectionsWalkIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Cycling">
            <ToggleButton value="cycling" aria-label="Cycling">
              <DirectionsBikeIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Driving">
            <ToggleButton value="driving" aria-label="Driving">
              <DirectionsCarIcon fontSize="small" />
            </ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>

        <Typography variant="body2" color={error ? 'error' : 'text.secondary'} sx={{ minWidth: 160 }}>
          {status}
        </Typography>

        {isFetching && <CircularProgress size={16} />}

        <Tooltip title="Finish route (Enter)">
          <span>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckIcon />}
              disabled={waypointCount < 2}
              onClick={onFinish}
            >
              Finish
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Cancel (Esc)">
          <span>
            <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={onCancel} disabled={waypointCount === 0}>
              Cancel
            </Button>
          </span>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
