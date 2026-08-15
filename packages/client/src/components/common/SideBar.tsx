import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { ThemeProvider } from '@mui/material/styles';
import { sidebarTheme } from '../../lib/sidebarTheme';

interface SideBarProps {
  children?: ReactNode;
}

// Fixed 400px tool sidebar, docked to the right of MenuBar. Later phases
// stack Search/BaseLayer/Layers/Properties sections here as plain children
// in document flow — unlike the old Panel.tsx, this container itself has no
// per-section positioning, each section just occupies its natural place.
// Wrapped in sidebarTheme (dark mode) so children get correct light-on-dark
// MUI defaults without each one hand-overriding text/icon colors.
export function SideBar({ children }: SideBarProps) {
  return (
    <ThemeProvider theme={sidebarTheme}>
      <Box
        component="aside"
        aria-label="Map tools"
        sx={{
          position: 'fixed',
          top: 0,
          left: 60,
          width: 400,
          height: '100vh',
          bgcolor: 'rgba(35,37,35,0.86)',
          color: 'common.white',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2,
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  );
}
