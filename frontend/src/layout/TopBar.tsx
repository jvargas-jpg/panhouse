import { useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../auth/useAuth';

export function TopBar() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  }

  return (
    <header className="flex items-center justify-between border-b border-tinta/10 bg-white px-4 py-3 sm:px-6">
      <span className="font-semibold text-tinta">Panhouse Gestor Editorial</span>

      <div className="flex items-center gap-3">
        {user?.rol === 'jefe_area' && (
          <button
            type="button"
            title="Notificaciones"
            className="relative rounded-md p-2 text-tinta/60 transition hover:bg-tinta/5 hover:text-tinta"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
        )}
        <span className="hidden text-sm text-tinta/70 sm:inline">{user?.nombre}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          className="rounded-md border border-tinta/20 px-3 py-1.5 text-sm font-medium text-tinta transition hover:bg-tinta/5 disabled:opacity-60"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
