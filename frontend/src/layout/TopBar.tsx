import { useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../auth/useAuth';
import { NotificacionesCampana } from './NotificacionesCampana';

export function TopBar() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  }

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-tinta/10 bg-white px-4 py-3 sm:px-6">
      <span className="min-w-0 text-sm font-semibold text-tinta sm:text-base">Panhouse Gestor Editorial</span>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificacionesCampana />
        <span className="hidden text-sm text-tinta/70 sm:inline">{user?.nombre}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="shrink-0 whitespace-nowrap rounded-md border border-tinta/20 px-3 py-1.5 text-xs font-medium text-tinta transition hover:bg-tinta/5 disabled:opacity-60 sm:text-sm"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
