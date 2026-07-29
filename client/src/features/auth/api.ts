import type { UserDTO } from '@mapinski/shared';
import { apiClient } from '../../lib/apiClient';

export async function fetchCurrentUser(): Promise<UserDTO | null> {
  try {
    const { data } = await apiClient.get<UserDTO>('/api/auth/me');
    return data;
  } catch (err: unknown) {
    if (axiosIsUnauthorized(err)) return null;
    throw err;
  }
}

function axiosIsUnauthorized(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'response' in err && (err as { response?: { status?: number } }).response?.status === 401;
}

export function googleLoginUrl(): string {
  const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
  return `${baseURL}/api/auth/google`;
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}
