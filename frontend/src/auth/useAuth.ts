import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import type { Usuario } from '../types/api';
import { fetchMe, login as loginRequest, logout as logoutRequest } from './authApi';

export const meQueryKey = ['auth', 'me'] as const;

// null = se consultó y no hay sesión (no es un error de pantalla,
// GET /me devuelve 401 sin cookie válida). undefined = todavía no se sabe.
export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: async (): Promise<Usuario | null> => {
      try {
        const { user } = await fetchMe();
        return user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginRequest(email, password),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(meQueryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.setQueryData(meQueryKey, null);
    },
  });
}
