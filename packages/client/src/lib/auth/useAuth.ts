import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, logout as logoutRequest } from './api';

const AUTH_QUERY_KEY = ['auth', 'me'];

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchCurrentUser,
  });

  async function logout() {
    await logoutRequest();
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
  }

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: Boolean(user),
    logout,
  };
}
