import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from './useAuth';

export function RequireAuth() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-crema text-tinta/70">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
