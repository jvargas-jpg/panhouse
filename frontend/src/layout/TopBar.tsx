import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '../auth/useAuth';
import { NotificacionesCampana } from './NotificacionesCampana';
import { useShellNavigation } from './AppFrame';
import { RrppIcon } from '../rrpp/RrppIcons';

export function TopBar({ compacto = false, tools }: { compacto?: boolean; roleLabel?: string; tools?: ReactNode }) {
  const { data: user } = useMe();
  const logout = useLogout(), navigate = useNavigate();
  const navigation = useShellNavigation();
  const account = <div className="ph-account flex shrink-0 items-center gap-2 sm:gap-3">
    {user?.rol === 'direccion' && <Link to="/configuracion/integraciones/google-drive" className="hidden rounded-md px-2 py-1.5 text-xs font-medium text-tinta hover:bg-tinta/5 md:inline">Integraciones</Link>}
    <NotificacionesCampana />
    <span className="hidden text-sm text-tinta/70 sm:inline">{user?.nombre}</span>
    <button type="button" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })} disabled={logout.isPending}
      className="shrink-0 whitespace-nowrap rounded-md border border-tinta/20 px-3 py-1.5 text-xs font-medium text-tinta transition hover:bg-tinta/5 disabled:opacity-60 sm:text-sm">Cerrar sesión</button>
  </div>;
  if (compacto) return <div role="group" aria-label="Cuenta de usuario" className="ph-account-group">{account}</div>;
  return <header className="ph-topbar flex shrink-0 items-center justify-between border-b border-tinta/10 bg-white px-4 py-3 sm:px-6">
    <div className="flex min-w-0 items-center gap-2">
      {navigation.available && <button type="button" className="ph-icon-button ph-menu-toggle" aria-label="Abrir navegación" aria-expanded={navigation.open} aria-controls="ph-mobile-navigation" onClick={() => navigation.setOpen(true)}><RrppIcon nombre="menu" /></button>}
      <span className="ph-product-name min-w-0 text-sm font-semibold text-tinta sm:text-base">Panhouse Gestor Editorial</span>
    </div>
    {tools && <div className="ph-topbar-tools">{tools}</div>}{account}
  </header>;
}
