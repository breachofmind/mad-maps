import type { ReactNode } from 'react';
import Paper, { type PaperProps } from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box, { type BoxProps } from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';

interface PanelProps extends PaperProps {
  side: 'left' | 'right';
  width: number;
  maxHeight: string;
}

// TRANSITIONAL: left-side offset past the new SideBar (53px MenuBar + 240px
// SideBar) so LayerPropertiesPanel/FeaturePropertiesPanel/BulkFeaturePropertiesPanel
// don't render underneath it. Panel itself (and this offset) goes away once
// those panels are reparented inside SideBar directly.
const SIDEBAR_CLEARANCE = 309;

// Shared absolute-positioned shell for the layer list, layer properties,
// feature properties, and bulk-edit panels — anchors to a top corner of the
// map and caps its own height so PanelHeader can stay fixed while PanelBody
// scrolls independently.
export function Panel({ side, width, maxHeight, sx, children, ...rest }: PanelProps) {
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        top: 72,
        [side]: side === 'left' ? SIDEBAR_CLEARANCE : 16,
        zIndex: 1,
        width,
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}

// Fixed title row: never scrolls with PanelBody, so the close/action
// buttons stay reachable no matter how long the panel's content grows.
export function PanelHeader({ title, actions, onClose, closeLabel = 'Close panel' }: PanelHeaderProps) {
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ px: 2, pt: 2, pb: 1.5, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
    >
      <Typography variant="subtitle1" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        {actions}
        {onClose && (
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose} aria-label={closeLabel}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );
}

// Scrollable remainder of the panel, below the fixed PanelHeader.
export function PanelBody({ sx, children, ...rest }: BoxProps) {
  return (
    <Box sx={{ overflowY: 'auto', px: 2, pt: 2, pb: 2, ...sx }} {...rest}>
      {children}
    </Box>
  );
}
