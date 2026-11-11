import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from './useAuth';
import {AdminViewAsBanner} from './AdminViewAsBanner';

export function RequireAuth() {
  const location=useLocation();
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-crema text-tinta/70">Cargando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{returnTo:location.pathname+location.search}} replace />;
  }
  if(user.rol==='autor'&&!location.pathname.startsWith('/autor')&&!location.pathname.startsWith('/mis-libros'))return <Navigate to="/autor" replace/>;

  return user.adminView?<div className="view-as-root"><AdminViewAsBanner user={user}/><div className="view-as-surface"><Outlet/></div></div>:<Outlet />;
}
