import '../jefeEdicion/editorialChief.css';
import { useSearchParams } from 'react-router-dom';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { TopBar } from '../layout/TopBar';
import { PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { useMe } from '../auth/useAuth';
import { EDITOR_NAV, EditorNav } from './EditorParts';
import { EditorInicio } from './EditorInicio';
import { EditorMiTrabajo } from './EditorMiTrabajo';
import { EditorMisProyectos } from './EditorMisProyectos';
import { EditorMisSolicitudes } from './EditorMisSolicitudes';

const DESCRIPTIONS: Record<string, string> = {
  inicio: 'Tu panorama editorial de hoy: pendientes, próximas entregas y novedades de tus proyectos.',
  'mi-trabajo': 'Intervenciones asignadas, entregas, feedback por aplicar y bloqueos.',
  'mis-proyectos': 'Los proyectos en los que participas, tu intervención actual y tu historial.',
  'mis-solicitudes': 'Solicitudes que enviaste a Jefatura de Edición o al Especialista, y su respuesta.',
};

export function EditorHomePage() {
  const { data: user } = useMe();
  const [params] = useSearchParams();
  const active = EDITOR_NAV.find(n => n[0] === params.get('vista'))?.[0] ?? 'inicio';

  return <CrmSidebarLayout nav={<EditorNav active={active} />} logo={PRODUCTION_LOGO} sidebarWidth={244} sidebarBreakpoint="lg" contentMaxWidth="max-w-none" contentClassName="ec-shell"
    footer={<div className="ec-sidebar-footer"><span className="ec-avatar">{user?.nombre.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span><div><strong>Editor</strong><small>Área de Edición</small></div><p>Historias que conectan.</p></div>}>
    <div className="ec-topbar"><div><span className="ec-top-context">Gestor editorial</span><small>Área de Edición</small></div><TopBar compacto /></div>
    <EditorNav active={active} mobile />
    <div className="ec-body">
      <header className="ec-page-header"><div><span>ÁREA DE EDICIÓN</span><h1>{EDITOR_NAV.find(n => n[0] === active)![1]}</h1><p>{DESCRIPTIONS[active]}</p></div></header>
      {active === 'mi-trabajo' ? <EditorMiTrabajo /> : active === 'mis-proyectos' ? <EditorMisProyectos /> : active === 'mis-solicitudes' ? <EditorMisSolicitudes /> : <EditorInicio />}
    </div>
  </CrmSidebarLayout>;
}
