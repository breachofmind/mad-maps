import type { ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box, { type BoxProps } from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAutoHideScrollbar, scrollbarAutoHideSx } from '../../lib/useAutoHideScrollbar';

interface PanelHeaderProps {
  title: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  // Renders a collapse/expand toggle when both are provided — the caller
  // owns the collapsed state and is responsible for hiding its own body
  // (e.g. wrapping it in <Collapse in={!collapsed}>).
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  // Used to build the toggle's aria-label ("Collapse Base Layer" /
  // "Expand Base Layer") — pass the section's plain-text name, since
  // `title` may not itself be a string.
  collapseLabel?: string;
}

// Fixed title row: never scrolls with PanelBody, so the close/action
// buttons stay reachable no matter how long the panel's content grows.
export function PanelHeader({
  title,
  actions,
  onClose,
  closeLabel = 'Close panel',
  collapsed = false,
  onToggleCollapse,
  collapseLabel = 'panel',
}: PanelHeaderProps) {
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
        {onToggleCollapse && (
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
            <IconButton
              size="small"
              onClick={onToggleCollapse}
              aria-label={collapsed ? `Expand ${collapseLabel}` : `Collapse ${collapseLabel}`}
            >
              {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
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

// Scrollable remainder of the panel, below the fixed PanelHeader — fills
// whatever height its flex-column parent gives it (flex:1, minHeight:0) and
// scrolls independently within that, rather than growing to fit its content
// and pushing everything else (including PanelHeader) off-screen along with
// it. Callers must be a flex column with a bounded height for this to take
// effect — see LayerPropertiesPanel/FeaturePropertiesPanel/etc.'s root Box.
export function PanelBody({ sx, children, ...rest }: BoxProps) {
  const { isScrolling, onScroll } = useAutoHideScrollbar();
  return (
    <Box
      {...rest}
      onScroll={onScroll}
      data-scrolling={isScrolling}
      sx={[
        { flex: 1, minHeight: 0, overflowY: 'auto', px: 2, pt: 2, pb: 2, ...scrollbarAutoHideSx },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
