import { useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import type { AreaFicha, ResumenFichaViva } from '../../../../shared/fichaViva';
import { useMe } from '../../auth/useAuth';
import { CrmSidebarLayout } from '../../layout/CrmSidebarLayout';
import { RoleProjectNavigation, retornoProyecto, destinoProyectos } from '../../layout/RoleProjectNavigation';
import { RRPP_FOOTER, RRPP_LOGO } from '../../rrpp/RrppSidebarNav';
import { Actividad, Card, dateFicha, Equipo, Estado, FichaSkeleton, IconFicha, ReadFields, WorkspaceLink } from './FichaElements';
import { ExpedienteDocumental, HistorialCompleto } from './ExpedienteDocumental';
import { useFichaViva } from './useFichaViva';
import './fichaViva.css';
import { ProjectWorkspaceCard } from '../ProjectWorkspaceCard';
import '../commandCenter.css';

function EstadoProyecto({data}:{data:ResumenFichaViva}){
  const summary=data.summary;
  return <section className="fv-states" aria-label="Estado actual del proyecto"><div className="fv-state-card"><span>Trabajo editorial</span><strong>{summary.active??'—'} <small>{summary.active===1?'intervención activa':'intervenciones activas'}</small></strong><p>{summary.completed??'—'} cerradas · {summary.pending??'—'} pendientes{(summary.blocked??0)>0?' · '+summary.blocked+' bloqueadas':''}</p></div><div className="fv-state-card"><span>Información comercial</span><Estado state={summary.commercial}/><p>{summary.commercialMissing.length?summary.commercialMissing.length+' datos por completar':'Datos de la venta completos'}</p>{summary.commercialMissing.length>0&&<details><summary>Ver pendientes</summary><ul>{summary.commercialMissing.map(x=><li key={x}>{x}</li>)}</ul></details>}</div><div className="fv-state-card"><span>Ingreso RRPP</span><Estado state={summary.rrpp}/><p>{summary.rrpp==='Completo'?'Entregado a Jefatura':summary.rrppMissing.length?summary.rrppMissing.length+' datos del diagnóstico pendientes':'Contexto editorial registrado'}</p>{summary.rrppMissing.length>0&&<details><summary>Ver pendientes</summary><ul>{summary.rrppMissing.map(x=><li key={x}>{x}</li>)}</ul></details>}</div><div className="fv-state-card fv-state-launch"><span>Lanzamiento y promoción</span><Estado state={summary.launch}/>{summary.launchPhase&&<p className="fv-launch-phase">{summary.launchPhase}</p>}<p>{summary.launchEnabled?(summary.launchDate?'Fecha tentativa · '+dateFicha(summary.launchDate):'Planificación habilitada · sin fecha'):data.secondaryErrors.includes('Lanzamiento')?'Habilitación pendiente de consulta':'Se habilita al alcanzar el hito editorial'}</p></div></section>;
}
function Operativa({data,onArea,onHistory}:{data:ResumenFichaViva;onArea:(id:AreaFicha)=>void;onHistory:()=>void}){
  return <div className="fv-operative">
    <Card title="Visión general" icon="book" className="fv-overview"><ReadFields fields={data.overview}/></Card>
    <Card title="Tu gestión" icon="grid" className="fv-actions">{data.myActions.length?<div className="fv-action-list">{data.myActions.slice(0,4).map(action=><Link key={action.label} to={action.href} className={'fv-action '+(action.primary?'fv-action-primary':'')}><div><strong>{action.label}</strong><span>{action.description}</span></div><IconFicha name="arrow"/></Link>)}</div>:<p className="fv-empty">Consulta el recorrido y los documentos del proyecto desde las áreas de trazabilidad.</p>}</Card>
    <Card title="Trazabilidad" className="fv-traceability" action={<span className="fv-head-caption">9 áreas</span>}><ol className="fv-area-list">{data.traceability.map((area,i)=><li key={area.id}><button onClick={()=>onArea(area.id)} aria-label={'Consultar '+area.name}><span className="fv-area-number">{String(i+1).padStart(2,'0')}</span><span className="fv-area-name">{area.name}</span><Estado state={area.state}/><span className="fv-chevron" aria-hidden="true">›</span></button></li>)}</ol><p className="fv-trace-note">Abre un área para ver sus datos y documentos.</p></Card>
    <Card title="Equipo editorial" icon="people" className="fv-team-card"><Equipo items={data.team}/></Card>
    <Card title="Actividad reciente" icon="clock" className="fv-recent" action={<button className="fv-text-button" onClick={onHistory}>Ver historial</button>}><Actividad items={data.recentActivity}/></Card>
    <Card title="Procesos complementarios" icon="grid" className="fv-related">{data.relatedProcesses.map(process=><div key={process.name} className="fv-related-item"><div><strong>{process.name}</strong><Estado state={process.state}/></div><p>{process.detail}</p>{process.href&&<WorkspaceLink href={process.href}>Consultar</WorkspaceLink>}</div>)}</Card>
  </div>;
}
export function FichaVivaPage(){
  const {id}=useParams(), {data:user}=useMe(), location=useLocation();
  if(user && ['especialista','jefe_area'].includes(user.rol)) return <Navigate to={'/proyectos/'+id+'/ficha'+location.search+location.hash} replace/>;
  return <FichaVivaLegacyPage/>;
}
function FichaVivaLegacyPage(){
  const {id=''}=useParams<{id:string}>();
  const {data:user}=useMe();
  const identity=user?user.id+':'+user.rol:undefined;
  const query=useFichaViva(id,identity);
  const [params,setParams]=useSearchParams();
  const location=useLocation();
  const complete=params.get('modo')==='completa';
  const [selected,setSelected]=useState<AreaFicha>((location.hash.replace('#','')||'proyecto') as AreaFicha);
  const [history,setHistory]=useState(false);
  const showArea=(area:AreaFicha)=>{setSelected(area);setParams(previous=>{const next=new URLSearchParams(previous);next.set('modo','completa');return next;});};
  const origen=retornoProyecto(params.get('volver'));
  const nav=<RoleProjectNavigation rol={user?.rol} origen={origen}/>;
  const back=origen??destinoProyectos(user?.rol);
  return <CrmSidebarLayout contexto="fullscreen" sidebarBreakpoint="lg" nav={nav} logo={RRPP_LOGO} footer={RRPP_FOOTER} contentMaxWidth="max-w-[1480px]" contentClassName="fv-container">
    <RoleProjectNavigation rol={user?.rol} origen={origen} mobile/>
    {query.isPending?<FichaSkeleton/>:query.isError?<div className="fv-page-error" role="alert"><IconFicha/><h1>No se pudo abrir la ficha</h1><p>{query.error.message}</p><button className="fv-button" onClick={()=>query.refetch()}>Reintentar</button><Link to={back}>Volver a proyectos</Link></div>:<>
      <nav className="fv-breadcrumb" aria-label="Ubicación"><Link to={back}>{origen?.includes('vista=asignaciones')?'Asignaciones y carga':'Proyectos'}</Link><span aria-hidden="true">/</span><Link to={`/proyectos/${id}${origen?'?volver='+encodeURIComponent(origen):''}`}>{query.data.project.title}</Link><span aria-hidden="true">/</span><span>Ficha de trazabilidad</span></nav>
      <nav className="fv-project-navigation" aria-label="Vistas del proyecto"><Link to={`/proyectos/${id}${origen?'?volver='+encodeURIComponent(origen):''}`}>Resumen del proyecto</Link><span aria-current="page">Ficha de trazabilidad</span></nav>
      <header className="fv-header"><div className="fv-header-main"><span className="fv-eyebrow">Expediente editorial <span>#{query.data.project.code}</span></span><h1>{query.data.project.title}</h1><p className="fv-author">{query.data.authors.map(a=>a.name).join(' · ')||'Sin autor registrado'}</p><div className="fv-project-meta"><span>{query.data.project.service}</span><span>{query.data.project.unit}</span><Estado state={query.data.project.macroState}/></div></div><div className="fv-header-actions"><button className={'fv-button '+(complete?'':'fv-primary')} onClick={()=>setParams(previous=>{const next=new URLSearchParams(previous);if(complete)next.delete('modo');else next.set('modo','completa');return next;})}><IconFicha name={complete?'grid':'document'}/>{complete?'Volver al resumen':'Ver ficha completa'}</button><span>Actualizado {dateFicha(query.data.project.updatedAt)}</span></div></header>
      <EstadoProyecto data={query.data}/>
      {user&&['rrpp','direccion'].includes(user.rol)&&<ProjectWorkspaceCard id={id} editable={false} compact/>}
      {query.data.secondaryErrors.length>0&&<p className="fv-notice" role="status">Hay consultas pendientes: {query.data.secondaryErrors.join(', ')}. <button onClick={()=>query.refetch()}>Reintentar</button></p>}
      {complete?<ExpedienteDocumental id={id} identity={identity} summary={query.data} selected={selected} onSelect={setSelected}/>:<Operativa data={query.data} onArea={showArea} onHistory={()=>setHistory(true)}/>}
      {history&&<HistorialCompleto id={id} identity={identity} onClose={()=>setHistory(false)}/>}
    </>}
  </CrmSidebarLayout>;
}
