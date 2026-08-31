import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../auth/useAuth';

// Portal del Autor: shell propio y deliberadamente distinto del panel
// interno (layout/AppLayout.tsx, TopBar oscura + sidebar) — el cliente
// ve una barra superior clara y minimalista, sin ningún rastro del look
// interno de producción.
export function AutorLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  }

  const inicial = user?.nombre?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <Link to="/mis-libros" className="font-semibold text-tinta">
          Panhouse <span className="text-dorado">Editorial</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="flex items-center gap-2 rounded-full border border-gray-200 py-1 pl-1 pr-3 text-sm font-medium text-tinta transition hover:bg-gray-50"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-dorado/20 text-xs font-bold text-dorado">
              {inicial}
            </span>
            <span className="hidden sm:inline">{user?.nombre}</span>
          </button>

          {menuAbierto && (
            <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <p className="truncate px-4 py-2 text-xs text-gray-500">{user?.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logout.isPending}
                className="block w-full px-4 py-2 text-left text-sm text-tinta transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
