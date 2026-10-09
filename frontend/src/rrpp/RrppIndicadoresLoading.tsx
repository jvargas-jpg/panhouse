import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { RRPP_FOOTER, RRPP_LOGO, RrppSidebarNav } from './RrppSidebarNav';
import './rrppIndicadores.css';
export function SkeletonRrpp() {
  return <div role="status" aria-label="Cargando indicadores RRPP" className="rrpp-i-skeleton motion-safe:animate-pulse"><div className="rrpp-i-kpis">{Array.from({ length: 5 }, (_, i) => <div className="rrpp-i-card h-32" key={i}><div className="h-3 w-3/4 rounded bg-slate-100" /><div className="mt-5 h-8 w-12 rounded bg-slate-100" /></div>)}</div><div className="rrpp-i-main-grid"><div className="rrpp-i-card h-60" /><div className="rrpp-i-card h-60" /></div><div className="rrpp-i-three-grid">{[1, 2, 3].map(i => <div className="rrpp-i-card h-44" key={i} />)}</div><div className="rrpp-i-two-grid"><div className="rrpp-i-card h-60" /><div className="rrpp-i-card h-60" /></div></div>;
}
export function RrppIndicadoresLoading() {
  return <CrmSidebarLayout logo={RRPP_LOGO} footer={RRPP_FOOTER} nav={<RrppSidebarNav vista="indicadores" />} contentMaxWidth="max-w-[1680px]" contentClassName="px-4 py-5 sm:px-6 sm:py-5"><div className="rrpp-indicadores"><header className="rrpp-i-header"><div><h1><span aria-hidden="true" />Indicadores</h1><p>Visualiza el impacto y avance de las acciones de RRPP en los proyectos editoriales.</p></div></header><SkeletonRrpp /></div></CrmSidebarLayout>;
}
