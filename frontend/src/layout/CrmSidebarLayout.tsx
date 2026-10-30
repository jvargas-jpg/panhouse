import { useEffect, type ReactNode } from 'react';
import { BrandFooter, PanhouseLogo } from '../design-system/Brand';
import { Dialog } from '../design-system/Dialog';
import { useShellNavigation } from './AppFrame';

export const NAV_ACTIVO = 'ph-nav-item ph-nav-active';
export const NAV_INACTIVO = 'ph-nav-item';

/** Shared visual shell; navigation and content keep each role's information architecture. */
export function CrmSidebarLayout({ nav, children, overlays, contentMaxWidth = 'max-w-5xl', contexto = 'app',
  contentClassName = 'px-6 py-10', shellClassName = '',
}: {
  nav: ReactNode; children: ReactNode; overlays?: ReactNode;
  contentMaxWidth?: string; contexto?: 'app' | 'fullscreen'; contentClassName?: string;
  shellClassName?: string;
}) {
  const { open, setOpen, setAvailable } = useShellNavigation();
  useEffect(() => { setAvailable(true); return () => setAvailable(false); }, [setAvailable]);
  const navigation = <div className="ph-sidebar-navigation">{nav}</div>;
  return <div className={`ph-shell ${contexto === 'fullscreen' ? 'h-full w-full' : 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6 h-[calc(100%+3rem)]'} flex overflow-hidden ${shellClassName}`}>
    <aside className="ph-sidebar"><div className="ph-brand"><PanhouseLogo /></div>{navigation}<BrandFooter /></aside>
    <div className="ph-content-scroll flex-1 overflow-y-auto overflow-x-hidden"><div className={`ph-content mx-auto w-full ${contentMaxWidth} ${contentClassName}`}>{children}</div></div>
    {overlays}
    {open && <Dialog title="Navegación de PanHouse" variant="navigation" onClose={() => setOpen(false)}><div id="ph-mobile-navigation" className="ph-navigation-body"><div className="ph-brand"><PanhouseLogo /></div><div onClick={e => { if ((e.target as HTMLElement).closest('a,button')) setOpen(false); }}>{navigation}</div><BrandFooter /></div></Dialog>}
  </div>;
}
