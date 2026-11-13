import { ProjectGuide } from './ProjectGuide';
import { ValidationManagement, ValidationTimeline } from '../validaciones/ValidationManagement';
import { AuthorWorkflowPanel } from '../portalAutor/AuthorWorkflowPanel';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { AreaFicha } from '../../../shared/fichaViva';
import type { ProjectCommandCenter } from '../../../shared/projectCommandCenter';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { RoleProjectNavigation, retornoProyecto, destinoProyectos } from '../layout/RoleProjectNavigation';


import { Actividad, Card, dateFicha, Equipo, Estado, ReadFields } from './fichaViva/FichaElements';
import { ExpedienteDocumental } from './fichaViva/ExpedienteDocumental';
import { useActividadFicha } from './fichaViva/useFichaViva';
import { CommandCenterProceso } from './CommandCenterProceso';
import { CommandCenterContexto } from './CommandCenterContexto';
import { invalidarOperacion } from './operacionQueries';
import { derivarLineaPrincipal, enCurso, TERMINALES } from './operacionWorkflow';
import { OperacionTimeline } from './OperacionTimeline';
import { TrabajosParalelosPanel, RamaParalela } from './TrabajosParalelosPanel';
import { ProjectWorkspaceCard } from './ProjectWorkspaceCard';
import { useProjectWorkspace } from './useProjectWorkspace';
// Admin reusa estos mismos componentes (no una segunda implementación):
// ya traen su propia carga de datos admin-gateada (useAdminQuery) y sus
// acciones reales (reasignar, reabrir tarea, reparar espacio documental).
import { ProjectTeam, WorkDrawer, WorkspacePanel } from '../admin/AdminProjects';
import { ActivityList } from '../admin/AdminOperations';
import { useAdminQuery } from '../admin/adminApi';
import type { AdminProject } from '../../../shared/admin';
import './fichaViva/fichaViva.css';
import './commandCenter.css';
import '../admin/admin.css';

const tabs = [{ id: '', label: 'Resumen' }, { id: 'operacion', label: 'Operación' }, { id: 'equipo', label: 'Equipo' }, { id: 'ficha', label: 'Ficha' }, { id: 'actividad', label: 'Actividad' }];
const tabsAdmin = [...tabs, { id: 'archivos', label: 'Archivos' }, { id: 'auditoria', label: 'Auditoría' }];
const operables = ['preparacion_inicial', 'edicion', 'correccion', 'direccion_creativa', 'diseno', 'revision_interna_cubierta', 'validacion_cubierta', 'calidad', 'soporte_digital', 'lanzamiento', 'impresion', 'distribucion'];
// Misma fuente para Resumen y Operación: causas de salud.riesgo con regla
// de umbral real (ver evaluarAtencionJefatura, server/helpers/jefatura.ts),
// más el gate financiero cuando realmente bloquea — nunca duplicado.
function derivarAtencion(data: ProjectCommandCenter) {
  const solvencia = data.administracion.find(f => f.key === 'solvencia')?.value;
  const gateFinanciero = data.administracion.find(f => f.key === 'gateFinanciero')?.value;
  const gateBloqueado = gateFinanciero === 'Bloqueado';
  const causasReales = (data.salud?.riesgo.causas ?? []).filter(c => ['Plazo operativo excedido', '80% del plazo operativo consumido', 'Proyecto marcado como retrasado'].includes(c));
  return { solvencia, gateFinanciero, gateBloqueado, causasReales, atencionTotal: data.atencion.length + causasReales.length + (gateBloqueado ? 1 : 0) };
}
function AtencionList({ data, causasReales, gateBloqueado, onEditarContexto, onOpenProceso }: { data: ProjectCommandCenter; causasReales: string[]; gateBloqueado: boolean; onEditarContexto: () => void; onOpenProceso: (tipo: string) => void }) {
  const total = data.atencion.length + causasReales.length + (gateBloqueado ? 1 : 0);
  if (!total) return <p className="cc-empty-attention">Sin acciones pendientes registradas.</p>;
  return <>
    {gateBloqueado && <p className="cc-attention-item"><strong>Gate financiero bloqueado</strong><span>Solvencia sin confirmar por Comercial →</span></p>}
    {causasReales.map(c => <p className="cc-attention-item" key={c}><strong>{c}</strong><span>Plazo del proyecto</span></p>)}
    {data.atencion.map(a => a.href ? <Link className="cc-attention-item" to={a.href} key={a.id}><strong>{a.titulo}</strong><span>{a.detalle} →</span></Link> : <button key={a.id} className="cc-attention-item" onClick={() => { if(a.editarContexto)onEditarContexto();else if(a.proceso)onOpenProceso(a.proceso); }}><strong>{a.titulo}</strong><span>{a.detalle} →</span></button>)}
  </>;
}
const hashes: Record<string, string> = { digital: 'soporte_digital', creativa: 'direccion_creativa', 'proceso-creativo': 'direccion_creativa' };
function procesoHash(value: string) { return hashes[value] ?? value; }
function origenLabel(origen: string | null, jefe: boolean, admin = false) {
  const vista = origen ? new URLSearchParams(origen.split('?')[1]).get('vista') : null;
  return ({ 'mis-proyectos': 'Mis proyectos', 'mi-trabajo': 'Mi trabajo', solicitudes: 'Solicitudes', objetivos: 'Objetivos del mes', seguimiento: 'Seguimiento', asignaciones: 'Asignaciones y carga', indicadores: 'Indicadores', decisiones: 'Decisiones', inicio: 'Inicio' } as Record<string, string>)[vista ?? ''] ?? (admin ? 'Proyectos' : jefe ? 'Proyectos' : 'Mis proyectos');
}
function DialogProceso({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const before = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { ref.current?.close(); before?.focus(); }; }, []);
  return <dialog ref={ref} className="cc-dialog" aria-label={title} onCancel={onClose}><header><div><span className="cc-eyebrow">GESTIÓN DEL PROCESO</span><h2>{title}</h2></div><button className="cc-close" onClick={onClose} aria-label="Cerrar proceso">×</button></header><div className="cc-dialog-body">{children}</div></dialog>;
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
  const isAdmin = user?.rol === 'admin';
  const allowed = user && ['especialista', 'jefe_area', 'rrpp', 'admin'].includes(user.rol);
  const query = useQuery({ queryKey: ['proyecto', id, 'command-center', identity], queryFn: () => apiFetch<ProjectCommandCenter>('/proyectos/'+id+'/command-center'), enabled: !!allowed, staleTime: 15000, refetchInterval: 15000 });
  useProjectWorkspace(id,query.data?.preparacion.workspace,!!allowed);
  const tab = location.pathname.split('/')[3] ?? '';
  // Admin: igual que sus tabs Equipo/Archivos en /admin, se piden solo al
  // abrir esa tab — no entran en el payload base que usan especialista/
  // jefatura/rrpp a cada carga del Resumen.
  const adminProject = useAdminQuery<AdminProject>(isAdmin && ['equipo','archivos'].includes(tab) ? '/proyectos/'+id : null);
  const origen = retornoProyecto(params.get('volver')), jefe = user?.rol === 'jefe_area';
  const back = origen ?? destinoProyectos(user?.rol), selected = params.get('proceso');
  const [area, setArea] = useState<AreaFicha>('proyecto');
  const [editarContexto, setEditarContexto] = useState(params.get('modo') === 'titulos');
  const [work, setWork] = useState<string | null>(null);
  const [paralelosAbierto, setParalelosAbierto] = useState(false);
  // Native workflows mutate through their existing APIs. Refresh only this project's projections.
  useEffect(() => cache.getMutationCache().subscribe(event => {
    if (event.type === 'updated' && event.action.type === 'success') {
      invalidarOperacion(cache, id);
      cache.invalidateQueries({ queryKey: ['proyecto', id] });
      cache.invalidateQueries({ queryKey: ['ficha-viva', id] });
      cache.invalidateQueries({ queryKey: ['especialista-inicio', identity] });
      cache.invalidateQueries({ queryKey: ['especialista-inicio-actividad', identity] });
      cache.invalidateQueries({ queryKey: ['especialista-cartera', user?.id] });
       cache.invalidateQueries({ queryKey: ['mi-trabajo'] });
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
  // Una sola vez por render — Resumen, Operación y el modal de un paso
  // (para saber si es "incompleto histórico") leen la misma derivación.
  const linea = data ? derivarLineaPrincipal(data) : null;
  const guided = !!data?.guide && ['especialista','jefe_area'].includes(user?.rol ?? '');
  const ficha = data?.ficha;
  const fichaEnShell = ficha && { ...ficha, traceability: ficha.traceability.map(a => a.workspace?.href.startsWith('/proyectos/'+id) ? { ...a, workspace: { ...a.workspace, href: to('operacion', {proceso: procesoHash(a.id)}) } } : a) };
  const areaSeleccionada = ficha?.traceability.find(a => a.id === (params.get('area') || location.hash.slice(1) || area))?.id ?? 'proyecto';
  return <CrmSidebarLayout contexto="fullscreen"   nav={<RoleProjectNavigation rol={user?.rol} origen={origen}/>}   contentMaxWidth="max-w-[1480px]" contentClassName="cc-container">

    <div className="cc-body"><nav className="cc-breadcrumb" aria-label="Ubicación"><Link to={back}>← {origenLabel(origen, jefe, isAdmin)}</Link><span>/</span><span>Proyecto editorial</span></nav>
    {query.isPending ? <div className="cc-skeleton" role="status" aria-label="Cargando proyecto"><div/><div/><div/></div> : query.isError ? <Card title="No se pudo abrir el proyecto"><p role="alert">{query.error.message}</p><button className="fv-button" onClick={() => query.refetch()}>Reintentar</button></Card> : ficha && data && <>
      <header className="cc-header"><div><span className="cc-eyebrow">{isAdmin ? 'ADMINISTRACIÓN · CONTEXTO COMPLETO' : jefe ? 'JEFATURA · SUPERVISIÓN EDITORIAL' : user?.rol==='rrpp' ? 'RRPP · COORDINACIÓN EDITORIAL' : 'ESPECIALISTA · COORDINACIÓN EDITORIAL'} <span>#{ficha.project.code}</span></span><h1>{ficha.project.title}</h1><p>{ficha.authors.map(a => a.name).join(' · ')}</p><div className="cc-meta"><span>{ficha.project.service}</span><span>{ficha.project.unit}</span><Estado state={ficha.project.macroState}/>{data.salud?.express.estado === 'confirmado' && <span className="cc-express">⚡ Express</span>}</div></div><div className="cc-header-side"><span>Fecha objetivo</span><strong>{dateFicha(data.salud?.fechaObjetivo ?? null)}</strong><small>Actualizado {dateFicha(ficha.project.updatedAt)}</small></div></header>
      <nav className="cc-tabs" aria-label="Vistas del proyecto">{(guided ? [{id:'',label:'Gu?a'}, {id:'ficha',label:'Informaci?n del proyecto'}, {id:'equipo',label:'Equipo'}, {id:'actividad',label:'Historial'}] : isAdmin ? tabsAdmin : tabs).map(t => <Link key={t.id} to={to(t.id)} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</Link>)}</nav>
      {ficha.secondaryErrors.length > 0 && <p role="status" className="fv-notice">Consultas pendientes: {ficha.secondaryErrors.join(', ')}. <button onClick={() => query.refetch()}>Reintentar</button></p>}
      {guided && (tab === '' || tab === 'operacion') && <ProjectGuide id={id} data={data}/>}
      {!guided && tab === '' && (() => {
        // Resumen = qué pasa ahora. El resto de administracion[] (contrato,
        // abonos, presupuesto, alianza, capítulos/páginas) y los campos
        // contractuales de ficha.overview siguen íntegros en Ficha → Proyecto
        // / Ingreso; aquí solo se proyectan las 2 señales que sí condicionan
        // el flujo (ver estadoFinanciero.ts: financialGateStatus).
        const { solvencia, gateFinanciero, gateBloqueado, causasReales } = derivarAtencion(data);
        const { pasos, actualIndex, paralelos } = linea!;
        const pasoActual = actualIndex >= 0 ? pasos[actualIndex] : null;
        // Síntesis, no el grid completo: el paso actual (una línea) y hasta
        // 3 ramas paralelas relevantes (con acción pendiente o en curso) —
        // la línea completa vive únicamente en Operación.
        const ramasRelevantes = paralelos.filter(p => p.estado !== 'No aplica' && (p.action || enCurso(p))).slice(0, 3);
        return <>
          <div className="cc-summary-grid">
            <Card title="Requiere atención" icon="clock" className="cc-attention"><AtencionList data={data} causasReales={causasReales} gateBloqueado={gateBloqueado} onEditarContexto={() => setEditarContexto(true)} onOpenProceso={open}/></Card>
            <Card title="Estado actual" icon="book" className="cc-state-card"><ReadFields fields={[
              { key: 'especialista', label: 'Especialista responsable', value: data.salud?.especialista?.nombre, source: 'project_assignments vigente' },
              { key: 'margen', label: 'Margen del plazo interno', value: ['culminado','retirado'].includes(ficha.project.macroState) ? 'Proyecto cerrado' : data.salud ? new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(data.salud.riesgo.diasRestantes)+' días' : null, source: 'Motor central de plazos' },
              { key: 'ejecucion', label: 'Días efectivos', value: data.salud ? new Intl.NumberFormat('es',{maximumFractionDigits:1}).format(data.salud.riesgo.diasEfectivos) : null, source: 'Duración efectiva descontando pausas' },
              { key: 'solvencia', label: 'Solvencia', value: solvencia, source: 'Comercial; aprobación explícita' },
              { key: 'gateFinanciero', label: 'Gate financiero', value: gateFinanciero, source: 'Estado financiero central' },
            ]}/><ProjectWorkspaceCard id={id} editable={data.preparacion.editable} initial={data.preparacion.workspace} compact structure={false}/><details className="cc-historical"><summary>Ingreso y asignación · contexto previo</summary><ReadFields fields={data.contextoPrevio}/></details>{data.capabilities.registrarAvance && <CommandCenterContexto id={id} data={data} abierto={editarContexto}/>}</Card>
          </div>
          <section className="cc-section"><div className="cc-section-head"><div><span className="cc-eyebrow">OPERACIÓN</span><h2>{pasoActual ? pasoActual.nombre : 'Línea principal completada'}</h2></div><Link to={to('operacion')}>Ver operación completa →</Link></div>
            {pasoActual ? <div className="cc-row" onClick={() => open(pasoActual.tipo)} role="button" tabIndex={0} onKeyDown={e => e.key==='Enter'&&open(pasoActual.tipo)}>
              <div className="cc-row-main"><strong>Paso actual</strong><Estado state={pasoActual.estado}/></div>
              <span className="cc-row-detail">{pasoActual.detalle}</span>
            </div> : <p className="cc-caption">Todos los pasos de producción ya están completados.</p>}
            {!!ramasRelevantes.length && <div className="cc-summary-paralelos">{ramasRelevantes.map(p => <RamaParalela key={p.tipo} proceso={p} onOpen={() => open(p.tipo)} compact/>)}</div>}
          </section>
          <Card title="Actividad reciente" icon="clock" action={<Link to={to('actividad')}>Ver historial</Link>}><Actividad items={ficha.recentActivity}/></Card>
        </>;
      })()}
      {!guided && (tab === '' || tab === 'operacion') && user && ['especialista','jefe_area'].includes(user.rol) && <AuthorWorkflowPanel projectId={id}/>}
      {!guided && (tab === '' || tab === 'operacion') && user && ['especialista','jefe_area'].includes(user.rol) && <ValidationManagement projectId={id}/>}
      {tab === 'actividad' && <ValidationTimeline projectId={id}/>}
      {!guided && tab === 'operacion' && (() => {
        const { causasReales, gateBloqueado } = derivarAtencion(data);
        const { paralelos } = linea!;
        const paralelosActivos = paralelos.filter(p => p.estado !== 'No aplica' && enCurso(p)).length;
        return <>
          <Card title="Requiere atención" icon="clock" className="cc-attention"><AtencionList data={data} causasReales={causasReales} gateBloqueado={gateBloqueado} onEditarContexto={() => setEditarContexto(true)} onOpenProceso={open}/></Card>
          <div className="cc-op-toolbar"><button type="button" className="cc-paralelos-button" onClick={() => setParalelosAbierto(true)}>Trabajos paralelos{paralelosActivos>0 && <span className="cc-badge">{paralelosActivos}</span>}</button></div>
          <OperacionTimeline id={id} data={data} especialista={user?.rol==='especialista'} rrpp={user?.rol==='rrpp'} onOpenPaso={open}/>
          {paralelosAbierto && <TrabajosParalelosPanel paralelos={paralelos} onClose={() => setParalelosAbierto(false)} onOpenPaso={tipo => { setParalelosAbierto(false); open(tipo); }}/>}
        </>;
      })()}
      {tab === 'equipo' && (isAdmin
        ? (adminProject.data ? <ProjectTeam project={adminProject.data}/> : <p role="status">Consultando equipo…</p>)
        : <Card title="Equipo del proyecto" icon="people"><p className="cc-caption">Asignaciones vigentes y responsables de cada intervención.</p><Equipo items={ficha.team}/><div className="cc-team-actions">{jefe ? <Link className="fv-button" to={'/?vista=asignaciones&proyecto='+id}>Gestionar Especialista</Link> : <Link className="fv-button" to={to('operacion', { proceso: 'edicion' })}>Consultar asignación de Edición</Link>}<p>Edición asigna al Editor; Corrección y Diseño mantienen sus propios flujos de asignación.</p></div></Card>)}
      {tab === 'archivos' && isAdmin && (adminProject.data ? <WorkspacePanel project={adminProject.data}/> : <p role="status">Consultando espacio documental…</p>)}
      {tab === 'auditoria' && isAdmin && <section className="ad-panel"><ActivityList project={id} paginate technical/></section>}
      {tab === 'ficha' && fichaEnShell && <><ProjectWorkspaceCard id={id} editable={false} initial={data.preparacion.workspace} compact/><ExpedienteDocumental id={id} identity={identity} summary={fichaEnShell} selected={areaSeleccionada} onSelect={value => { setArea(value); setParams(prev => { const p = new URLSearchParams(prev); p.set('area', value); return p; }); }}/></>}
      {tab === 'actividad' && identity && <ActividadProyecto id={id} identity={identity} canWrite={!guided && data.capabilities.registrarAvance}/>}
      {!guided && selected && process && (() => {
        // Mismo criterio que PasoIncompletoPrevio (operacionWorkflow.ts):
        // un paso ANTERIOR al actual en la secuencia, no Completo/Cancelado.
        const idx = linea!.pasos.findIndex(p => p.tipo === process.tipo);
        const esHistorico = idx >= 0 && idx < linea!.actualIndex && !TERMINALES.includes(process.estado);
        const historico = esHistorico ? { pasoActualNombre: linea!.pasos[linea!.actualIndex]?.nombre ?? '' } : undefined;
        return <DialogProceso title={process.nombre} onClose={close}>
          {/* preparacion_inicial ya muestra este mismo aviso con contexto
              completo dentro de CommandCenterPreparacion (vía historico) —
              evita duplicarlo; el resto de tipos sí lo necesita acá porque
              aún no tienen su propio tratamiento de "incompleto histórico". */}
          {esHistorico && process.tipo !== 'preparacion_inicial' && <p className="cc-step-warning" role="alert">Este paso quedó incompleto, aunque el proyecto ya tiene trabajo posterior registrado.</p>}
          {!['lanzamiento','impresion'].includes(process.tipo)&&<p className="cc-caption">{process.detalle}</p>}<div className="cc-work-history">{(!['lanzamiento','impresion'].includes(process.tipo)?process.trabajos:[]).map(t => <div key={t.id}><Estado state={t.stateLabel??t.estado}/><strong>{t.responsable ?? 'Sin asignación individual'}</strong><span>{t.instancia === 'default' ? 'Intervención inicial' : t.instancia}</span><small>Entrega: {dateFicha(t.vence)} · Cierre: {dateFicha(t.cierre)}</small>{t.decisionId && <Link to={jefe ? '/?vista=decisiones&decision='+t.decisionId : '/decisiones/'+t.decisionId+'/responder'}>Consultar decisión</Link>}{isAdmin && <button className="ad-button secondary compact" onClick={() => setWork(t.id)}>Modo administrativo</button>}</div>)}</div>
          {operables.includes(process.tipo) && process.estado !== 'No aplica' && <CommandCenterProceso id={id} tipo={process.tipo} especialista={user?.rol==='especialista'} rrpp={user?.rol==='rrpp'} data={data} proceso={process} historico={historico}/>}
        </DialogProceso>;
      })()}
      {isAdmin && work && <WorkDrawer id={work} onClose={() => setWork(null)}/>}
    </>}</div>
  </CrmSidebarLayout>;
}
