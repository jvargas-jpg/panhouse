import { useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../auth/useAuth';
import { NotificacionesCampana } from './NotificacionesCampana';

export function TopBar({ compacto = false }: { compacto?: boolean }) {
  const Container = compacto ? 'div' : 'header';
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) });
  }

  return (
    <Container role={compacto ? 'group' : undefined} aria-label={compacto ? 'Cuenta de usuario' : undefined} className={compacto ? 'jp-account' : 'flex shrink-0 items-center justify-between border-b border-tinta/10 bg-white px-4 py-3 sm:px-6'}>
      {!compacto && <span className="min-w-0 text-sm font-semibold text-tinta sm:text-base">Panhouse Gestor Editorial</span>}

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificacionesCampana />
        <span className="hidden text-sm text-tinta/70 sm:inline">{user?.nombre}</span>
        {compacto && <span className="jp-avatar jp-account-avatar" aria-hidden="true">{user?.nombre.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>}
        <button
          type="button"
          onClick={handleLogout}
          disabled={logout.isPending}
          className={compacto ? 'jp-account-logout' : 'shrink-0 whitespace-nowrap rounded-md border border-tinta/20 px-3 py-1.5 text-xs font-medium text-tinta transition hover:bg-tinta/5 disabled:opacity-60 sm:text-sm'}
        >
          Cerrar sesión
        </button>
      </div>
    </Container>
  );
}
