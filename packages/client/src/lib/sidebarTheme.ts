import { createTheme } from '@mui/material/styles';

// Wraps SideBar's children so every nested MUI component (Typography,
// List, Select, Menu, Autocomplete popper, ...) gets correct light-on-dark
// text/icon/divider/selected-row colors for free, instead of each section
// hand-overriding color on every element it renders.
export const sidebarTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { paper: '#1a1c1b', default: 'transparent' },
    // No primary override — MUI's dark-mode default (#90caf9) reads far
    // better against this dark paper than the light-mode blue (#1976d2)
    // would, which is what an explicit override here used to pin in place.
  },
  components: {
    // MUI's default outline has no transition, so the hover border (be it
    // its own default, or one of the flat/no-border inputs re-adding it —
    // see BaseLayerPanel, SearchBox, RemoteLayerStyleControls) snaps
    // instantly instead of fading in/out.
    MuiOutlinedInput: {
      styleOverrides: {
        notchedOutline: {
          transition: 'border-color 150ms ease-in-out',
        },
      },
    },
  },
});
