import { createTheme } from '@mui/material/styles';

// Wraps SideBar's children so every nested MUI component (Typography,
// List, Select, Menu, Autocomplete popper, ...) gets correct light-on-dark
// text/icon/divider/selected-row colors for free, instead of each section
// hand-overriding color on every element it renders.
export const sidebarTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { paper: '#1a1c1b', default: 'transparent' },
    primary: { main: '#1976d2' },
  },
});
