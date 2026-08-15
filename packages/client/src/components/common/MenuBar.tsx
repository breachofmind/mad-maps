import type { MouseEvent } from 'react';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface MenuBarProps {
  onLogoClick?: () => void;
  onDownloadClick?: (event: MouseEvent<HTMLElement>) => void;
  onAccountClick?: (event: MouseEvent<HTMLElement>) => void;
}

// Fixed 53px app-level icon rail, always present on the left edge of the
// editor. Callbacks receive the click event (not just fire) so callers can
// anchor a Menu off event.currentTarget, matching MUI's controlled-menu
// idiom — MapMenu/AccountMenu are wired to this in later phases.
export function MenuBar({ onLogoClick, onDownloadClick, onAccountClick }: MenuBarProps) {
  return (
    <Stack
      component="nav"
      aria-label="App menu"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 53,
        height: '100vh',
        bgcolor: '#232523',
        alignItems: 'center',
        pt: 1.5,
        pb: 1.5,
        zIndex: 2,
      }}
    >
      <Tooltip title="Your maps" placement="right">
        <IconButton
          onClick={onLogoClick}
          aria-label="Back to your maps"
          sx={{
            width: 35,
            height: 35,
            border: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            borderRadius: 1,
          }}
        >
          <Typography variant="subtitle1" sx={{ color: 'common.white', fontWeight: 700 }}>
            M
          </Typography>
        </IconButton>
      </Tooltip>

      <Divider sx={{ width: 35, my: 1.5, borderColor: 'rgba(255,255,255,0.16)' }} />

      <Tooltip title="Export / import" placement="right">
        <IconButton onClick={onDownloadClick} aria-label="Export or import map data" sx={{ color: 'common.white' }}>
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      <Tooltip title="Account" placement="right">
        <IconButton onClick={onAccountClick} aria-label="Account menu" sx={{ color: 'common.white' }}>
          <AccountCircleIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
