import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  // Workspace changes invalidate the shared dossier without copying data.
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ficha-viva'] });
      void queryClient.invalidateQueries({ queryKey: ['soporte-digital', 'inicio'] });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (falloPrevio, error) => {
        // 401/403 no se arreglan reintentando — es la sesión, no la red.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          return false;
        }
        return falloPrevio < 2;
      },
    },
  },
});
