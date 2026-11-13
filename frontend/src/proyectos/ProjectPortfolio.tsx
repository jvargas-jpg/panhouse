import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { GuidedPortfolio, GuidedProjectSummary } from '../../../shared/projectPortfolio';
import { apiFetch } from '../lib/api';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { SpecialistSidebarNav } from '../layout/RoleProjectNavigation';
import { JefaturaSidebar } from '../jefatura/JefaturaSidebar';
import { operationalDate } from './OperationHomePage';
import { PageHeader, Surface, FilterBar, SearchInput, StatusBadge, Button, Skeleton, EmptyState, Pagination } from '../design-system/components';

const STATE_OPTIONS: [string,string][] = [
 ['all','Proyectos activos'],['risk','Requieren atención por riesgo'],['actionable','Con acciones disponibles'],
 ['waiting','Con esperas'],['blocked','Con bloqueos'],['closed','Históricos y cerrados'],
];

export function ProjectPortfolioRow({ project: p, chief = false }: { project: GuidedProjectSummary; chief?: boolean }) {
 const target='/proyectos/'+p.id;
 const mainLabel=p.mainProcess?.label??(p.specialist||['culminado','retirado'].includes(p.macroState)?'Procesos editoriales completados':'Asignación pendiente');
 const due=p.dueAt ? new Intl.DateTimeFormat('es-VE',{day:'numeric',month:'short',year:'numeric',timeZone:p.dueAt.length===10?'UTC':'America/Caracas'}).format(new Date(p.dueAt.length===10?p.dueAt+'T12:00:00Z':p.dueAt)) : null;
 return <Surface className="p-5">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0"><Link to={target} className="text-lg font-semibold text-gray-900 hover:underline">{p.title}</Link><p className="mt-1 text-sm text-gray-500">{p.authors} · #{p.code}</p></div>
   <StatusBadge tone={p.overdue?'danger':undefined}>{p.overdue?'Plazo vencido':p.macroState.replaceAll('_',' ')}</StatusBadge>
  </header>
  <div className="mt-4 flex flex-wrap items-baseline gap-2 text-sm">
   <span className="text-xs uppercase tracking-wide text-gray-400">Proceso principal</span>
   <strong className="text-gray-900">{mainLabel}</strong>
   {p.mainProcess&&<Link to={target+'?proceso='+p.mainProcess.id} className="text-gray-600 underline underline-offset-2">{p.mainProcess.currentStep}</Link>}
   {p.mainProcess?.waitingFor&&<StatusBadge tone="warning">{'Esperando a '+p.mainProcess.waitingFor}</StatusBadge>}
  </div>
  {p.parallelProcesses.length>0&&<ul className="mt-3 flex flex-col gap-2 border-l-2 border-gray-100 pl-3" aria-label="Procesos paralelos">
   {p.parallelProcesses.map(path=><li key={path.id} className="text-sm">
    <Link to={target+'?proceso='+path.id} className="flex flex-wrap items-center gap-2">
     <strong className="text-gray-900">{path.label}</strong>
     <StatusBadge tone={path.waitingFor?'warning':path.state==='Bloqueado'?'danger':path.requiresAction?'info':undefined}>{path.waitingFor?'Esperando a '+path.waitingFor:path.state==='Bloqueado'?'Bloqueado':path.requiresAction?'Acción disponible':path.state}</StatusBadge>
    </Link>
    <small className="block text-xs text-gray-500">{path.state==='Bloqueado'?path.blockingReasons.join(' · '):path.currentStep}</small>
   </li>)}
  </ul>}
  {p.nextMilestones.length>0&&<p className="mt-3 text-xs text-gray-500">Próximos hitos: {p.nextMilestones.slice(0,2).map(m=>m.label+(m.dueAt?' · '+operationalDate(m.dueAt):'')).join(' / ')}</p>}
  {p.risks.map((risk,i)=><p key={i} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{risk.message}</p>)}
  <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
   <span className="text-xs text-gray-500">{p.service}{chief?` · Especialista: ${p.specialist??'Pendiente de asignación'}`:''}{due?` · Objetivo: ${due}`:''}</span>
   <Link className="ph-button ph-button-secondary" to={target}>{chief?'Supervisar proyecto':p.actionable?'Continuar proyecto':'Consultar proyecto'} →</Link>
  </footer>
 </Surface>;
}

export function ProjectPortfolio({ embedded=false }: {embedded?:boolean}) {
 const {data:user}=useMe(),[params,setParams]=useSearchParams(),[search,setSearch]=useState(params.get('q')??'');
 const chief=user?.rol==='jefe_area';
 useEffect(()=>setSearch(params.get('q')??''),[params]);
 const query=useQuery({queryKey:['project-portfolio',user?.id,params.get('q'),params.get('page'),params.get('state')],queryFn:()=>apiFetch<GuidedPortfolio>('/proyectos/guia-portafolio?'+new URLSearchParams({search:params.get('q')??'',page:params.get('page')??'1',state:params.get('state')??'all'})),enabled:!!user&&['especialista','jefe_area'].includes(user.rol),refetchInterval:15000});
 const update=(key:string,value:string)=>setParams(old=>{const p=new URLSearchParams(old);p.set(key,value);if(key!=='page')p.delete('page');return p;});
 const items=query.data?.items??[];
 const content=<div className="flex flex-col gap-6">
  {!embedded&&<PageHeader eyebrow={(chief?'Jefatura':'Especialista')+' · Gestión editorial'} title="Proyectos" description="Proceso principal, caminos paralelos y próximos hitos de cada proyecto."/>}
  <FilterBar>
   <form className="flex items-center gap-2" onSubmit={e=>{e.preventDefault();update('q',search.trim());}}>
    <SearchInput aria-label="Buscar proyectos" placeholder="Buscar autor, libro o código…" value={search} onChange={e=>setSearch(e.target.value)} onClear={()=>{setSearch('');update('q','');}}/>
    <Button type="submit" variant="secondary">Buscar</Button>
   </form>
   <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700" aria-label="Estado del portafolio" value={params.get('state')??'all'} onChange={e=>update('state',e.target.value)}>
    {STATE_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
   </select>
  </FilterBar>
  {query.isPending&&<Skeleton label="Consultando proyectos y procesos…"/>}
  {query.error&&<div role="alert" className="ph-empty"><p>{query.error.message}</p><Button variant="secondary" className="mt-3" onClick={()=>query.refetch()}>Reintentar</Button></div>}
  <div className="flex flex-col gap-4">{items.map(p=><ProjectPortfolioRow key={p.id} project={p} chief={chief}/>)}</div>
  {!items.length&&query.data&&<EmptyState>No hay proyectos para estos filtros.</EmptyState>}
  {query.data&&<Pagination total={query.data.total} page={query.data.page} pages={query.data.pages} onPage={n=>update('page',String(n))}/>}
 </div>;
 return embedded?content:<CrmSidebarLayout nav={chief?<JefaturaSidebar vista="proyectos"/>:<SpecialistSidebarNav/>} contentClassName="p-4 sm:p-7" contentMaxWidth="max-w-[1440px]">{content}</CrmSidebarLayout>;
}
