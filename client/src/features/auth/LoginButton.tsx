import Button from '@mui/material/Button';
import { googleLoginUrl } from './api';

export function LoginButton() {
  return (
    <Button
      variant="contained"
      href={googleLoginUrl()}
      data-testid="google-login-button"
    >
      Sign in with Google
    </Button>
  );
}
