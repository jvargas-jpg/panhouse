import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { OperationHome, OperationItem } from '../../../shared/operationHome';
import type { GuidedProjectSummary } from '../../../shared/projectPortfolio';
import { apiFetch } from '../lib/api';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { SpecialistSidebarNav } from '../layout/RoleProjectNavigation';
import { JefaturaSidebar } from '../jefatura/JefaturaSidebar';
import { invalidarOperacion } from './operacionQueries';
import { PageHeader, Surface, MetricCard, EmptyState, Skeleton, Button, StatusBadge } from '../design-system/components';
import { RrppIcon } from '../rrpp/RrppIcons';
import { MonthlyGoalsHomeSummary } from '../objetivos/MonthlyGoalsPage';

export function operationalDate(value:string|null|undefined) {
 if(!value)return 'Sin fecha registrada';
 return new Intl.DateTimeFormat('es-VE',{day:'numeric',month:'short',year:'numeric',...(value.length===10?{}:{hour:'2-digit',minute:'2-digit'}),timeZone:value.length===10?'UTC':'America/Caracas'}).format(new Date(value.length===10?value+'T12:00:00Z':value));
}
const processUrl=(project:string,process:string)=>'/proyectos/'+project+'?proceso='+encodeURIComponent(process);
const ROW_CLASS='flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4';
function WorkItem({item,waiting=false}:{item:OperationItem;waiting?:boolean}) {
 const p=item.process;
 return <article className={ROW_CLASS}><div className="min-w-0">
   <p className="text-xs text-gray-500">{item.project.title} · {p.label}</p>
   <h3 className="mt-0.5 text-sm font-semibold text-gray-900">{waiting?`Esperando a ${p.waitingFor}`:p.currentStep}</h3>
   <p className="mt-1 text-sm text-gray-600">{waiting?p.currentStep:item.reason}</p>
   <div className="mt-2 flex flex-wrap items-center gap-2">
    {waiting&&<span className="text-xs text-gray-500">Desde: {operationalDate(p.waitingSince)}{p.assignee?` · ${p.assignee}`:''}</span>}
    {p.dueAt&&<StatusBadge tone={item.overdue?'danger':'neutral'}>{(item.overdue?'Plazo vencido':'Vence')+': '+operationalDate(p.dueAt)}</StatusBadge>}
    {waiting&&item.availableElsewhere>0&&<span className="text-xs text-gray-500">{item.availableElsewhere} {item.availableElsewhere===1?'proceso disponible':'procesos disponibles'} mientras esperas</span>}
   </div>
  </div>
  <Link className={'ph-button shrink-0 '+(waiting?'ph-button-secondary':'ph-button-primary')} to={processUrl(item.project.id,p.id)}>{waiting?'Ver proyecto':'Continuar'} →</Link>
 </article>;
}
function NewAssignment({project:p}:{project:GuidedProjectSummary}) {
 const navigate=useNavigate(),cache=useQueryClient();
 const start=useMutation({mutationFn:()=>apiFetch('/proyectos/'+p.id+'/preparacion-inicial',{method:'PATCH',body:JSON.stringify({recibidoEn:new Date().toISOString()})}),onSuccess:()=>{invalidarOperacion(cache,p.id);navigate(processUrl(p.id,'preparacion_inicial'));}});
 return <article className={ROW_CLASS}><div className="min-w-0">
   <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
   <p className="mt-1 text-sm text-gray-600">{p.authors} · {p.service}</p>
   <p className="mt-1 text-xs text-gray-500">Asignado: {operationalDate(p.newAssignment?.assignedAt)}</p>
   <p className="mt-1 text-sm text-gray-600">Siguiente paso: {p.newAssignment?.nextStep}</p>
   {start.error&&<p role="alert" className="mt-1 text-sm text-red-600">{start.error.message}</p>}
  </div>
  <Button variant="primary" className="shrink-0" disabled={start.isPending} onClick={()=>start.mutate()}>{start.isPending?'Comenzando…':'Comenzar proyecto'} →</Button>
 </article>;
}
function SectionCard({title,count,empty,children}:{title:string;count?:number;empty?:boolean;children:ReactNode}) {
 return <Surface>
  <h2 className="px-4 pt-4 text-base font-semibold text-gray-900">{title}{count!==undefined&&<span className="ml-2 font-normal text-gray-400">{count}</span>}</h2>
  {empty?<EmptyState>{children}</EmptyState>:<div className="divide-y divide-gray-100">{children}</div>}
 </Surface>;
}
export function OperationHomeContent({data}:{data:OperationHome}) {
 const chief=data.role==='jefe_area';
 return <div className="flex flex-col gap-6">
  <PageHeader eyebrow={(chief?'Jefatura':'Especialista')+' · Inicio'} title={chief?'¿Dónde debo intervenir?':'Tu operación editorial'} description={chief?'Atiende las asignaciones y decisiones que permiten avanzar al equipo.':'Lo que puedes resolver hoy y las respuestas que estás esperando.'}/>
  {!chief&&<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
   <MetricCard icon={<RrppIcon nombre="proyectos"/>} label="Proyectos activos" value={data.summary.active}/>
   <MetricCard icon={<RrppIcon nombre="rapido"/>} label="Con acciones disponibles" value={data.summary.actionable}/>
   <MetricCard icon={<RrppIcon nombre="actividad"/>} label="Con esperas" value={data.summary.waiting}/>
   <MetricCard icon={<RrppIcon nombre="riesgo"/>} label="Con plazos vencidos" value={data.summary.overdue}/>
   <MetricCard icon={<RrppIcon nombre="ingreso"/>} label="Nuevas asignaciones" value={data.summary.newAssignments}/>
  </div>}
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
   <div className="flex min-w-0 flex-col gap-6">
    {chief?<>
     <SectionCard title="Asignaciones pendientes" empty={!data.interventions.some(i=>i.kind==='assignment')}>
      {data.interventions.some(i=>i.kind==='assignment')?data.interventions.filter(i=>i.kind==='assignment').map(i=><div className={ROW_CLASS} key={i.id}><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900">{i.title}</h3><p className="mt-1 text-sm text-gray-600">{i.reason}</p></div><Link className="ph-button ph-button-primary shrink-0" to={i.href}>Atender asignación →</Link></div>):'No hay asignaciones pendientes.'}
     </SectionCard>
     <SectionCard title="Decisiones que requieren tu intervención" empty={!data.interventions.some(i=>i.kind==='decision')}>
      {data.interventions.some(i=>i.kind==='decision')?data.interventions.filter(i=>i.kind==='decision').map(i=><div className={ROW_CLASS} key={i.id}><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900">{i.title}</h3><p className="mt-1 text-sm text-gray-600">{i.reason}</p></div><Link className="ph-button ph-button-primary shrink-0" to={i.href}>Resolver decisión →</Link></div>):'No hay decisiones pendientes.'}
     </SectionCard>
    </>:<>
     <SectionCard title="Requieren tu atención" count={data.actions.length} empty={!data.actions.length}>
      {data.actions.length?data.actions.map(item=><WorkItem key={item.project.id+':'+item.process.id} item={item}/>):'No tienes acciones pendientes en los procesos iniciados.'}
     </SectionCard>
     <SectionCard title="Nuevos proyectos" count={data.newAssignments.length} empty={!data.newAssignments.length}>
      {data.newAssignments.length?data.newAssignments.map(p=><NewAssignment key={p.id} project={p}/>):'No hay asignaciones sin comenzar.'}
     </SectionCard>
     <SectionCard title="Esperando respuestas o entregas" count={data.waiting.length} empty={!data.waiting.length}>
      {data.waiting.length?data.waiting.map(item=><WorkItem key={item.project.id+':'+item.process.id} item={item} waiting/>):'No hay respuestas o entregas pendientes de terceros.'}
     </SectionCard>
    </>}
    <SectionCard title={chief?'Proyectos que necesitan seguimiento':'Riesgos y atrasos'} empty={!data.risks.length}>
     {data.risks.length?data.risks.map((r,index)=><div className={ROW_CLASS} key={r.projectId+':'+index}><div className="min-w-0"><h3 className="text-sm font-semibold text-gray-900">{r.title}</h3><p className="mt-1 text-sm text-red-700">{r.message}</p></div><Link className="ph-button ph-button-secondary shrink-0" to={r.processId?processUrl(r.projectId,r.processId):'/proyectos/'+r.projectId}>Ver proyecto →</Link></div>):'No hay plazos vencidos registrados.'}
    </SectionCard>
   </div>
   <aside className="flex flex-col gap-6">
    {chief&&<Surface>
     <div className="flex items-center justify-between gap-3 px-4 pt-4"><h2 className="text-base font-semibold text-gray-900">Carga del equipo</h2><Link className="text-xs font-medium text-gray-500 underline" to="/?vista=asignaciones">Ver asignaciones y carga →</Link></div>
     <ul className="flex flex-col gap-3 p-4">{data.team.map(p=><li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><strong className="font-semibold text-gray-900">{p.nombre}</strong><span className="text-xs text-gray-500">{p.activos} proyectos · Carga {p.carga} · {p.enRiesgo} en riesgo</span></li>)}</ul>
    </Surface>}
    {!chief&&<MonthlyGoalsHomeSummary/>}
   </aside>
  </div>
 </div>;
}
export function OperationHomePage() {
 const {data:user}=useMe(),chief=user?.rol==='jefe_area';
 const query=useQuery({queryKey:['operation-home',user?.id],queryFn:()=>apiFetch<OperationHome>('/proyectos/guia-inicio'),enabled:!!user&&['especialista','jefe_area'].includes(user.rol),refetchInterval:15000});
 return <CrmSidebarLayout nav={chief?<JefaturaSidebar vista="inicio"/>:<SpecialistSidebarNav/>} contentClassName="p-4 sm:p-7" contentMaxWidth="max-w-[1440px]">
  {query.isPending?<Skeleton label="Consultando tu operación editorial…"/>:query.error?<div role="alert" className="ph-empty"><p>{query.error.message}</p><Button variant="secondary" className="mt-3" onClick={()=>query.refetch()}>Reintentar</Button></div>:<OperationHomeContent data={query.data}/>}
 </CrmSidebarLayout>;
}
