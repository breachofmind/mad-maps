import { useCallback, useRef, useState } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';

const HIDE_DELAY_MS = 800;

// Toggles `isScrolling` true on each scroll event and false again
// HIDE_DELAY_MS after the last one — pair with `scrollbarAutoHideSx` (and
// spread `data-scrolling`/`onScroll` onto the scrollable element) so its
// scrollbar thumb only fades in while actively scrolling.
export function useAutoHideScrollbar() {
  const [isScrolling, setIsScrolling] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = useCallback(() => {
    setIsScrolling(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsScrolling(false), HIDE_DELAY_MS);
  }, []);

  return { isScrolling, onScroll };
}

// WebKit-only (Chrome/Edge/Safari) — Firefox has no equivalent
// ::-webkit-scrollbar-* pseudo-elements to fade, so it falls back to its own
// normal thin scrollbar there instead of staying hidden.
export const scrollbarAutoHideSx: SxProps<Theme> = {
  '&::-webkit-scrollbar': { width: 8 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'transparent',
    borderRadius: 4,
    transition: 'background-color 0.3s ease',
  },
  '&[data-scrolling="true"]::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
};
