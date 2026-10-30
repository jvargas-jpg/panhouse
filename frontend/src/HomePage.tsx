import { Navigate, useLocation } from 'react-router-dom';
import { AutoresPage } from './autores/AutoresPage';
import { useMe } from './auth/useAuth';
import { AuditoriaPagosPage } from './cobranzas/AuditoriaPagosPage';
import { ComercialDashboardPage } from './comercial/ComercialDashboardPage';
import { CorrectorHomePage } from './corrector/CorrectorHomePage';
import { CorrectorMiTrabajo } from './corrector/CorrectorMiTrabajo';
import { CorrectorMisSolicitudes } from './corrector/CorrectorMisSolicitudes';
import { MisTrabajosDisenoPage } from './disenador/MisTrabajosDisenoPage';
import { EditorHomePage } from './editor/EditorHomePage';
import { JefeEdicionHomePage } from './jefeEdicion/JefeEdicionHomePage';
import { PanelJefaturaPage } from './jefatura/PanelJefaturaPage';
import { MisDireccionesCreativasPage } from './liderCreativo/MisDireccionesCreativasPage';
import { MisProyectosPage } from './proyectos/MisProyectosPage';
import { MiTrabajoPage } from './especialista/MiTrabajoPage';
import { SolicitudesPage } from './especialista/SolicitudesPage';
import { MonthlyGoalsPage } from './objetivos/MonthlyGoalsPage';
import { lazy, Suspense } from 'react';
const EspecialistaInicioPage = lazy(() => import('./especialista/EspecialistaInicioPage').then(m => ({default:m.EspecialistaInicioPage})));
import { RrppHomePage } from './rrpp/RrppHomePage';
import { SoporteDigitalHomePage } from './soporteDigital/SoporteDigitalHomePage';
import { SoporteDigitalMiTrabajo } from './soporteDigital/SoporteDigitalMiTrabajo';
import { SoporteDigitalMisSolicitudes } from './soporteDigital/SoporteDigitalMisSolicitudes';
import { SoporteEditorialHomePage } from './soporteEditorial/SoporteEditorialHomePage';
import { SoporteEditorialMiTrabajo } from './soporteEditorial/SoporteEditorialMiTrabajo';
import { SoporteEditorialMisSolicitudes } from './soporteEditorial/SoporteEditorialMisSolicitudes';

// Punto de entrada autenticado: qué pantalla ve cada quien depende del
// rol de la sesión, no de la ruta. RequireAuth ya garantizó que hay
// usuario antes de llegar acá.
export function HomePage() {
  const { data: user } = useMe();
  const location = useLocation();
  if(user?.rol==='admin')return <Navigate to="/admin/inicio" replace/>;

  if (user?.rol === 'especialista') {
    const vista = new URLSearchParams(location.search).get('vista') ?? '';
    if (['mis-proyectos', 'metricas'].includes(vista)) return <MisProyectosPage />;
    if (vista === 'mi-trabajo') return <MiTrabajoPage />;
    if (vista === 'solicitudes') return <SolicitudesPage />;
    if (vista === 'objetivos') return <MonthlyGoalsPage />;
    return <Suspense fallback={<p role="status">Cargando Inicio…</p>}><EspecialistaInicioPage /></Suspense>;
  }

  if (user?.rol === 'jefe_area') {
    return <PanelJefaturaPage />;
  }
  if (user?.rol === 'talento_humano') return <SolicitudesPage />;

  // Separados a pedido explícito del negocio: comercial tiene su propio
  // Inicio/Dashboard (ComercialDashboardPage.tsx) con lo que necesita
  // resolver día a día ("¿qué proyectos necesitan una acción mía?");
  // dirección sigue exactamente igual que siempre, en AutoresPage.tsx —
  // no se le tocó ni un píxel. El CRM de Autores/Proyectos que antes
  // era el Inicio de comercial no desapareció, sigue siendo AutoresPage.tsx,
  // ahora accesible en rutas propias (/autores, /proyectos, ver App.tsx).
  if (user?.rol === 'comercial') {
    return <ComercialDashboardPage />;
  }

  if (user?.rol === 'direccion') {
    return <AutoresPage />;
  }

  if (user?.rol === 'rrpp') {
    return <RrppHomePage />;
  }

  if (user?.rol === 'editor') {
    return <EditorHomePage />;
  }

  if (user?.rol === 'jefe_edicion') {
    return <JefeEdicionHomePage />;
  }

  if (user?.rol === 'corrector') {
    const vista = new URLSearchParams(location.search).get('vista');
    if (vista === 'mi-trabajo') return <CorrectorMiTrabajo />;
    if (vista === 'mis-solicitudes') return <CorrectorMisSolicitudes />;
    return <CorrectorHomePage />;
  }

  if (user?.rol === 'disenador') {
    return <MisTrabajosDisenoPage />;
  }

  // Fase 5 (5C Dirección Creativa) — pantalla propia, ya no comparte
  // DisenadorHomePage.tsx con 'disenador' (violaba la separación de
  // responsabilidades del master prompt 5C §19: Dirección Creativa no
  // es Diseñador).
  if (user?.rol === 'lider_creativo') {
    return <MisDireccionesCreativasPage />;
  }

  if (user?.rol === 'soporte_editorial') {
    const vista = new URLSearchParams(location.search).get('vista');
    if (vista === 'mi-trabajo') return <SoporteEditorialMiTrabajo />;
    if (vista === 'mis-solicitudes') return <SoporteEditorialMisSolicitudes />;
    return <SoporteEditorialHomePage />;
  }

  if (user?.rol === 'soporte_digital') {
    const vista = new URLSearchParams(location.search).get('vista');
    if (vista === 'mi-trabajo') return <SoporteDigitalMiTrabajo />;
    if (vista === 'mis-solicitudes') return <SoporteDigitalMisSolicitudes />;
    return <SoporteDigitalHomePage />;
  }

  if (user?.rol === 'cobranzas') {
    return <AuditoriaPagosPage />;
  }

  // Portal del Autor vive bajo su propio layout (AutorLayout.tsx, no el
  // sidebar interno de AppLayout.tsx) — redirige en vez de renderizar
  // acá adentro.
  if (user?.rol === 'autor') {
    return <Navigate to="/mis-libros" replace />;
  }

  return (
    <div className="rounded-lg border border-tinta/10 bg-white p-6 text-tinta/70 shadow-sm">
      Todavía no hay una pantalla para tu rol ({user?.rol}).
    </div>
  );
}
