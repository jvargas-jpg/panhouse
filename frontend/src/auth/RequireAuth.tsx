import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from './useAuth';
import {AdminViewAsBanner} from './AdminViewAsBanner';

export function RequireAuth() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-crema text-tinta/70">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.adminView?<div className="view-as-root"><AdminViewAsBanner user={user}/><div className="view-as-surface"><Outlet/></div></div>:<Outlet />;
}
