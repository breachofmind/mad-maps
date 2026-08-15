import type { ReactNode } from 'react';
import Box from '@mui/material/Box';

interface SideBarProps {
  children?: ReactNode;
}

// Fixed 240px tool sidebar, docked to the right of MenuBar. Later phases
// stack Search/BaseLayer/Layers/Properties sections here as plain children
// in document flow — unlike the old Panel.tsx, this container itself has no
// per-section positioning, each section just occupies its natural place.
export function SideBar({ children }: SideBarProps) {
  return (
    <Box
      component="aside"
      aria-label="Map tools"
      sx={{
        position: 'fixed',
        top: 0,
        left: 53,
        width: 240,
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
  );
}
