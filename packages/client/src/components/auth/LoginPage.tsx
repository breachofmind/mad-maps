import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Navigate } from 'react-router-dom';
import { LoginButton } from './LoginButton';
import { useAuth } from '../../lib/auth/useAuth';

export function LoginPage() {
  const { isLoading, isAuthenticated } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box display="flex" alignItems="center" justifyContent="center" height="100vh">
      <Stack spacing={3} alignItems="center">
        <Typography variant="h4">Mad Maps</Typography>
        <Typography variant="body1" color="text.secondary">
          Create and share custom maps.
        </Typography>
        <LoginButton />
      </Stack>
    </Box>
  );
}
