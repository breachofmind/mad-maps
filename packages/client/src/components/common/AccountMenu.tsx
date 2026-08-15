import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../lib/auth/useAuth';

interface AccountMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

// Controlled by its trigger (MenuBar's account_circle icon in MapEditorPage),
// mirroring MapMenu's anchorEl/onClose pattern.
export function AccountMenu({ anchorEl, onClose }: AccountMenuProps) {
  const { user, logout } = useAuth();

  function handleSignOut() {
    onClose();
    logout();
  }

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {user && (
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {user.email}
          </Typography>
        </MenuItem>
      )}
      <Divider />
      <MenuItem onClick={handleSignOut}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Sign out</ListItemText>
      </MenuItem>
    </Menu>
  );
}
