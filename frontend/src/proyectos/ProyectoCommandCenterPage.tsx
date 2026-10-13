import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { AreaFicha } from '../../../shared/fichaViva';
import type { ProjectCommandCenter, ProcesoProyecto } from '../../../shared/projectCommandCenter';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { RoleProjectNavigation, retornoProyecto, destinoProyectos, PRODUCTION_LOGO } from '../layout/RoleProjectNavigation';
import { RRPP_FOOTER } from '../rrpp/RrppSidebarNav';
import { TopBar } from '../layout/TopBar';
import { Actividad, Card, dateFicha, Equipo, Estado, ReadFields } from './fichaViva/FichaElements';
import { ExpedienteDocumental } from './fichaViva/ExpedienteDocumental';
import { useActividadFicha } from './fichaViva/useFichaViva';
import { CommandCenterProceso } from './CommandCenterProceso';
import { CommandCenterContexto } from './CommandCenterContexto';
import './fichaViva/fichaViva.css';
import './commandCenter.css';

const tabs = [{ id: '', label: 'Resumen' }, { id: 'operacion', label: 'Operación' }, { id: 'equipo', label: 'Equipo' }, { id: 'ficha', label: 'Ficha' }, { id: 'actividad', label: 'Actividad' }];
const operables = ['edicion', 'correccion', 'direccion_creativa', 'diseno', 'revision_interna_cubierta', 'calidad', 'soporte_digital', 'lanzamiento', 'impresion', 'distribucion'];
const hashes: Record<string, string> = { digital: 'soporte_digital', creativa: 'direccion_creativa', 'proceso-creativo': 'direccion_creativa' };
function procesoHash(value: string) { return hashes[value] ?? value; }
function origenLabel(origen: string | null, jefe: boolean) {
  const vista = origen ? new URLSearchParams(origen.split('?')[1]).get('vista') : null;
  return ({ 'mis-proyectos': 'Mis proyectos', 'mi-trabajo': 'Mi trabajo', solicitudes: 'Solicitudes', objetivos: 'Objetivos del mes', seguimiento: 'Seguimiento', asignaciones: 'Asignaciones y carga', indicadores: 'Indicadores', decisiones: 'Decisiones', inicio: 'Inicio' } as Record<string, string>)[vista ?? ''] ?? (jefe ? 'Proyectos' : 'Mis proyectos');
}
function DialogProceso({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const before = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { ref.current?.close(); before?.focus(); }; }, []);
  return <dialog ref={ref} className="cc-dialog" aria-label={title} onCancel={onClose}><header><div><span className="cc-eyebrow">GESTIÓN DEL PROCESO</span><h2>{title}</h2></div><button className="cc-close" onClick={onClose} aria-label="Cerrar proceso">×</button></header><div className="cc-dialog-body">{children}</div></dialog>;
}
function ProcesoCard({ proceso, onOpen }: { proceso: ProcesoProyecto; onOpen: () => void }) {
  const active = proceso.trabajos.filter(t => ['pendiente', 'en_progreso', 'bloqueado'].includes(t.estado));
  return <article className="cc-process"><header><h3>{proceso.nombre}</h3><Estado state={proceso.estado}/></header><p>{proceso.detalle}</p>
    {active.slice(0, 3).map(t => <div className={'cc-work '+(t.vencido?'cc-work-late':'')} key={t.id}><strong>{t.responsable ?? 'Sin asignación individual'}</strong><span>{t.vence ? 'Entrega · '+dateFicha(t.vence) : 'Sin entrega pautada'}{t.vencido?' · Vencida':''}</span>{(t.gate || t.decisionId) && <small>{t.decisionId ? 'Pendiente de decisión de Jefatura' : 'Condicionado por un gate del proceso'}</small>}</div>)}
    {operables.includes(proceso.tipo) && proceso.estado !== 'No aplica' && <button onClick={onOpen} className="cc-process-link">Consultar proceso <span aria-hidden="true">↗</span></button>}
  </article>;
}
function ActividadProyecto({ id, identity, canWrite }: { id: string; identity: string; canWrite: boolean }) {
  const query = useActividadFicha(id, identity, true), cache = useQueryClient();
  const [texto, setTexto] = useState('');
  const mutation = useMutation({ mutationFn: () => apiFetch('/proyectos/'+id+'/avances', { method: 'POST', body: JSON.stringify({ texto }) }), onSuccess: () => { setTexto(''); cache.invalidateQueries({ queryKey: ['ficha-viva', id] }); cache.invalidateQueries({ queryKey: ['proyecto', id] }); } });
  return <div className="cc-activity-grid"><Card title="Recorrido del proyecto" icon="clock">{query.isPending ? <p role="status">Consultando actividad…</p> : query.isError ? <p role="alert">{query.error.message} <button onClick={() => query.refetch()}>Reintentar</button></p> : <><Actividad items={query.data.pages.flatMap(p => p.items)}/>{query.hasNextPage && <button className="fv-button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Ver más actividad</button>}</>}</Card>{canWrite && <Card title="Registrar avance" icon="document"><form onSubmit={e => { e.preventDefault(); mutation.mutate(); }}><label className="cc-label" htmlFor="avance">Situación o avance editorial</label><textarea id="avance" className="cc-textarea" value={texto} onChange={e => setTexto(e.target.value)} minLength={10} maxLength={2000} required rows={6}/><p className="cc-caption">Se conserva como parte del historial, con tu nombre y la fecha del registro.</p><button className="fv-button fv-primary" disabled={mutation.isPending || texto.trim().length < 10}>{mutation.isPending ? 'Registrando…' : 'Registrar avance'}</button>{mutation.isError && <p role="alert">{mutation.error.message}</p>}{mutation.isSuccess && <p role="status">Avance registrado.</p>}</form></Card>}</div>;
}

export function ProyectoCommandCenterPage() {
  const { id = '' } = useParams(), { data: user } = useMe();
  const [params, setParams] = useSearchParams(), location = useLocation(), cache = useQueryClient();
  const identity = user ? user.id+':'+user.rol : undefined;
  const allowed = user && ['especialista', 'jefe_area'].includes(user.rol);
  const query = useQuery({ queryKey: ['proyecto', id, 'command-center', identity], queryFn: () => apiFetch<ProjectCommandCenter>('/proyectos/'+id+'/command-center'), enabled: !!allowed, staleTime: 15000 });
  const tab = location.pathname.split('/')[3] ?? '';
  const origen = retornoProyecto(params.get('volver')), jefe = user?.rol === 'jefe_area';
  const back = origen ?? destinoProyectos(user?.rol), selected = params.get('proceso');
  const [area, setArea] = useState<AreaFicha>('proyecto');
  const [editarContexto, setEditarContexto] = useState(params.get('modo') === 'titulos');
  // Native workflows mutate through their existing APIs. Refresh only this project's projections.
  useEffect(() => cache.getMutationCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'success') {
      cache.invalidateQueries({ queryKey: ['proyecto', id] });
      cache.invalidateQueries({ queryKey: ['ficha-viva', id] });
      cache.invalidateQueries({ queryKey: ['especialista-inicio', identity] });
      cache.invalidateQueries({ queryKey: ['especialista-inicio-actividad', identity] });
      cache.invalidateQueries({ queryKey: ['especialista-cartera', user?.id] });
       cache.invalidateQueries({ queryKey: ['mi-trabajo', user?.id] });
       cache.invalidateQueries({ queryKey: ['solicitudes', user?.id] });
       cache.invalidateQueries({ queryKey: ['contratos-correccion', id] });
    }
  }), [cache, id, identity]);
  const to = (target: string, extra?: Record<string, string>) => { const p = new URLSearchParams(params); p.delete('proceso'); p.delete('modo'); for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v); return '/proyectos/'+id+(target?'/'+target:'')+(p.size?'?'+p:''); };
  const open = (tipo: string) => setParams(prev => { const p = new URLSearchParams(prev); p.set('proceso', tipo); return p; });
  const close = () => setParams(prev => { const p = new URLSearchParams(prev); p.delete('proceso'); return p; });
  if (user && !allowed) return <Navigate to={'/proyectos/'+id+location.search} replace/>;
  if (location.hash && tab !== 'ficha') return <Navigate to={to('operacion', { proceso: procesoHash(location.hash.slice(1)) })} replace/>;
  const data = query.data, process = data?.procesos.find(p => p.tipo === selected);
  const ficha = data?.ficha;
  const fichaEnShell = ficha && { ...ficha, traceability: ficha.traceability.map(a => a.workspace?.href.startsWith('/proyectos/'+id) ? { ...a, workspace: { ...a.workspace, href: to('operacion', {proceso: procesoHash(a.id)}) } } : a) };
  const areaSeleccionada = ficha?.traceability.find(a => a.id === (params.get('area') || location.hash.slice(1) || area))?.id ?? 'proyecto';
  return <CrmSidebarLayout contexto="fullscreen" sidebarCompact sidebarBreakpoint="lg" nav={<RoleProjectNavigation rol={user?.rol} origen={origen}/>} logo={PRODUCTION_LOGO} footer={RRPP_FOOTER} contentMaxWidth="max-w-[1480px]" contentClassName="cc-container">
    <div className="cc-global-bar"><span>Operación editorial</span><TopBar compacto/></div><RoleProjectNavigation rol={user?.rol} origen={origen} mobile/>
    <div className="cc-body"><nav className="cc-breadcrumb" aria-label="Ubicación"><Link to={back}>← {origenLabel(origen, jefe)}</Link><span>/</span><span>Proyecto editorial</span></nav>
    {query.isPending ? <div className="cc-skeleton" role="status" aria-label="Cargando proyecto"><div/><div/><div/></div> : query.isError ? <Card title="No se pudo abrir el proyecto"><p role="alert">{query.error.message}</p><button className="fv-button" onClick={() => query.refetch()}>Reintentar</button></Card> : ficha && data && <>
      <header className="cc-header"><div><span className="cc-eyebrow">{jefe ? 'JEFATURA · SUPERVISIÓN EDITORIAL' : 'ESPECIALISTA · COORDINACIÓN EDITORIAL'} <span>#{ficha.project.code}</span></span><h1>{ficha.project.title}</h1><p>{ficha.authors.map(a => a.name).join(' · ')}</p><div className="cc-meta"><span>{ficha.project.service}</span><span>{ficha.project.unit}</span><Estado state={ficha.project.macroState}/>{data.salud?.express.estado === 'confirmado' && <span className="cc-express">⚡ Express</span>}</div></div><div className="cc-header-side"><span>Fecha objetivo</span><strong>{dateFicha(data.salud?.fechaObjetivo ?? null)}</strong><small>Actualizado {dateFicha(ficha.project.updatedAt)}</small></div></header>
      <nav className="cc-tabs" aria-label="Vistas del proyecto">{tabs.map(t => <Link key={t.id} to={to(t.id)} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</Link>)}</nav>
      {ficha.secondaryErrors.length > 0 && <p role="status" className="fv-notice">Consultas pendientes: {ficha.secondaryErrors.join(', ')}. <button onClick={() => query.refetch()}>Reintentar</button></p>}
      {tab === '' && <>
        <div className="cc-kpis" aria-label="Trabajo registrado">{[['En curso', ficha.summary.active], ['Pendientes', ficha.summary.pending], ['Bloqueadas', ficha.summary.blocked], ['Cerradas', ficha.summary.completed]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? '—'}</strong><small>intervenciones</small></div>)}</div>
        <div className="cc-summary-grid"><Card title="Requiere atención" icon="clock" className="cc-attention">{data.salud?.riesgo.causas.map(c => <p className="cc-risk" key={c}>{c}</p>)}{data.atencion.length ? data.atencion.map(a => a.href ? <Link className="cc-attention-item" to={a.href} key={a.id}><strong>{a.titulo}</strong><span>{a.detalle} →</span></Link> : <button key={a.id} className="cc-attention-item" onClick={() => { if(a.editarContexto)setEditarContexto(true);else if(a.proceso)open(a.proceso); }}><strong>{a.titulo}</strong><span>{a.detalle} →</span></button>) : <p className="cc-empty-attention">Sin acciones pendientes registradas.</p>}</Card>
        <Card title="Contexto editorial" icon="book"><ReadFields fields={[
          { key: 'especialista', label: 'Especialista responsable', value: data.salud?.especialista?.nombre, source: 'project_assignments vigente' },
          { key: 'margen', label: 'Margen del plazo interno', value: ['culminado','retirado'].includes(ficha.project.macroState) ? 'Proyecto cerrado' : data.salud ? new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(data.salud.riesgo.diasRestantes)+' días' : null, source: 'Motor central de plazos' },
          { key: 'ejecucion', label: 'Días efectivos', value: data.salud ? new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(data.salud.riesgo.diasEfectivos) : null, source: 'Duración efectiva descontando pausas' },
          ...ficha.overview.filter(f => ['ingresoFechaIngreso', 'coleccionPanhouse'].includes(f.key)),
        ]}/>{data.capabilities.registrarAvance && <CommandCenterContexto id={id} data={data} abierto={editarContexto}/>}</Card></div>
        <section className="cc-section"><div className="cc-section-head"><div><span className="cc-eyebrow">TRABAJO EN PARALELO</span><h2>Operación editorial</h2></div><Link to={to('operacion')}>Ver todos los procesos →</Link></div><div className="cc-process-grid">{data.procesos.filter(p => p.trabajos.some(t => ['pendiente', 'en_progreso', 'bloqueado'].includes(t.estado)) && operables.includes(p.tipo)).map(p => <ProcesoCard key={p.tipo} proceso={p} onOpen={() => open(p.tipo)}/>)}</div>{!data.procesos.some(p => operables.includes(p.tipo) && p.trabajos.some(t => ['pendiente', 'en_progreso', 'bloqueado'].includes(t.estado))) && <p className="cc-caption">No hay intervenciones editoriales abiertas. Consulta Operación para ver el historial y las áreas aún no iniciadas.</p>}</section>
        <div className="cc-summary-grid"><Card title="Actividad reciente" icon="clock" action={<Link to={to('actividad')}>Ver historial</Link>}><Actividad items={ficha.recentActivity}/></Card><Card title="Administración" icon="document"><p className="cc-caption">Datos de Comercial y Cobranzas · consulta</p><ReadFields fields={data.administracion}/></Card></div>
      </>}
      {tab === 'operacion' && <section className="cc-section"><div className="cc-section-head"><div><h2>Procesos del proyecto</h2><p>Intervenciones y entregas independientes, con sus responsables y condiciones.</p></div></div><div className="cc-process-grid">{data.procesos.map(p => <ProcesoCard key={p.tipo} proceso={p} onOpen={() => open(p.tipo)}/>)}</div></section>}
      {tab === 'equipo' && <Card title="Equipo del proyecto" icon="people"><p className="cc-caption">Asignaciones vigentes y responsables de cada intervención.</p><Equipo items={ficha.team}/><div className="cc-team-actions">{jefe ? <Link className="fv-button" to={'/?vista=asignaciones&proyecto='+id}>Gestionar Especialista</Link> : <Link className="fv-button" to={to('operacion', { proceso: 'edicion' })}>Consultar asignación de Edición</Link>}<p>Edición asigna al Editor; Corrección y Diseño mantienen sus propios flujos de asignación.</p></div></Card>}
      {tab === 'ficha' && fichaEnShell && <ExpedienteDocumental id={id} identity={identity} summary={fichaEnShell} selected={areaSeleccionada} onSelect={value => { setArea(value); setParams(prev => { const p = new URLSearchParams(prev); p.set('area', value); return p; }); }}/>}
      {tab === 'actividad' && identity && <ActividadProyecto id={id} identity={identity} canWrite={data.capabilities.registrarAvance}/>}
      {selected && process && <DialogProceso title={process.nombre} onClose={close}>
        <p className="cc-caption">{process.detalle}</p><div className="cc-work-history">{process.trabajos.map(t => <div key={t.id}><Estado state={t.estado}/><strong>{t.responsable ?? 'Sin asignación individual'}</strong><span>{t.instancia === 'default' ? 'Intervención inicial' : t.instancia}</span><small>Entrega: {dateFicha(t.vence)} · Cierre: {dateFicha(t.cierre)}</small>{t.decisionId && <Link to={jefe ? '/?vista=decisiones&decision='+t.decisionId : '/decisiones/'+t.decisionId+'/responder'}>Consultar decisión</Link>}</div>)}</div>
        {operables.includes(process.tipo) && process.estado !== 'No aplica' && <CommandCenterProceso id={id} tipo={process.tipo} especialista={!jefe}/>}
      </DialogProceso>}
    </>}</div>
  </CrmSidebarLayout>;
}
