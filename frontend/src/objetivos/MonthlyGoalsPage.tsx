import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { GoalCatalog, GoalHistory, GoalInput, GoalList, GoalSummary, MonthlyGoal, TeamGoals } from '../../../shared/monthlyGoals';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { PRODUCTION_LOGO, SpecialistSidebarNav } from '../layout/RoleProjectNavigation';
import { TopBar } from '../layout/TopBar';
import { RRPP_FOOTER } from '../rrpp/RrppSidebarNav';
import { RrppIcon } from '../rrpp/RrppIcons';
import './monthlyGoals.css';

const dateLabel=(s:string)=>new Intl.DateTimeFormat('es',{day:'numeric',month:'short',year:'numeric',timeZone:s.length===10?'UTC':'America/Caracas'}).format(new Date(s.length===10?s+'T12:00:00Z':s));
const currentPeriod=()=>new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',timeZone:'America/Caracas'}).format(new Date());
const periodLabel=(period:string)=>new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(period+'-01T12:00:00Z'));
const initials=(name:string)=>name.split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
const statusLabels={ACTIVO:'En curso',EN_RIESGO:'En riesgo',CUMPLIDO:'Cumplido',NO_CUMPLIDO:'No cumplido',CANCELADO:'Cancelado'};
const summaryCards=[{key:'total',label:'Objetivos totales',tone:''},{key:'assigned',label:'Asignados por Jefatura',tone:'blue'},{key:'own',label:'Mis objetivos',teamLabel:'Objetivos propios',tone:'teal'},
  {key:'active',label:'En curso',tone:''},{key:'risk',label:'En riesgo',tone:'amber'},{key:'completed',label:'Completados',tone:'green'}] as const;
const tabs=[{id:'all',label:'Todos',key:'total'},{id:'assigned',label:'Asignados por Jefatura',key:'assigned'},{id:'own',label:'Mis objetivos',key:'own'},
  {id:'active',label:'En curso',key:'active'},{id:'risk',label:'En riesgo',key:'risk'},{id:'completed',label:'Completados',key:'completed'}] as const;
type GoalTab=typeof tabs[number]['id'];
function ErrorBlock({error,retry}:{error:Error;retry:()=>void}) {return <div className="mg-error" role="alert"><span>{error.message}</span><button onClick={retry}>Reintentar</button></div>;}
function Skeleton({summary=false}:{summary?:boolean}) {return <div className={summary?'mg-summary':'mg-list'} role="status" aria-label="Cargando objetivos">{Array.from({length:summary?6:3},(_,i)=><div key={i} className={'mg-skeleton '+(summary?'':'mg-skeleton-row')}/>)}</div>;}
function Summary({data,team=false}:{data:GoalSummary;team?:boolean}) {return <section className="mg-summary" aria-label={team?'Resumen mensual del equipo':'Resumen mensual'}>{summaryCards.map(c=><div className={'mg-kpi '+c.tone} key={c.key}><strong>{data[c.key]}</strong><span>{team&&'teamLabel' in c?c.teamLabel:c.label}</span></div>)}</section>;}
function MonthSelector({period,onChange}:{period:string;onChange:(p:string)=>void}) {
  const change=(delta:number)=>{const [year,month]=period.split('-').map(Number),d=new Date(Date.UTC(year,month-1+delta,1));onChange(d.toISOString().slice(0,7));};
  return <div className="mg-month"><button aria-label="Mes anterior" disabled={period==='2000-01'} onClick={()=>change(-1)}>‹</button><label><RrppIcon nombre="calendario" className="h-4 w-4"/><span>{periodLabel(period)}</span><input type="month" aria-label="Seleccionar mes" value={period} min="2000-01" max="2200-12" onChange={e=>{if(/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(e.target.value))onChange(e.target.value);}}/></label><button aria-label="Mes siguiente" disabled={period==='2200-12'} onClick={()=>change(1)}>›</button></div>;
}
function GoalTabs({tab,summary,onChange,team}:{tab:GoalTab;summary?:GoalSummary;onChange:(t:GoalTab)=>void;team:boolean}) {
  return <nav className="mg-tabs" aria-label="Filtrar objetivos">{tabs.map(t=><button key={t.id} aria-current={tab===t.id?'page':undefined} onClick={()=>onChange(t.id)}>{team&&t.id==='own'?'Objetivos propios':t.label}{summary&&<span>{summary[t.key]}</span>}</button>)}</nav>;
}
function GoalCard({goal:g,team,origin,onDetail,onEdit,onCancel}:{goal:MonthlyGoal;team:boolean;origin:string;onDetail:()=>void;onEdit:()=>void;onCancel:()=>void}) {
  const [menu,setMenu]=useState(false),menuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!menu)return;const close=(e:PointerEvent)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);};},[menu]);
  const own=g.source==='ESPECIALISTA',remaining=g.daysRemaining;
  const due=remaining===0?'La fecha objetivo es hoy':remaining>0?`${remaining} ${remaining===1?'día restante':'días restantes'}`:`Venció hace ${Math.abs(remaining)} ${remaining===-1?'día':'días'}`;
  return <article className={'mg-goal '+(own?'mg-own':'mg-assigned')} aria-label={g.title}>
    <div className="mg-card-top"><span className={'mg-source '+(own?'teal':'blue')}><RrppIcon nombre={own?'persona':'equipo'} className="h-3 w-3"/>{own?(team?'Objetivo propio':'Mi objetivo'):'Asignado por Jefatura'}</span>{g.project?.express&&<span className="mg-express">Express</span>}
      <div className="mg-actions" ref={menuRef}><button className="mg-menu-toggle" aria-label={'Opciones de '+g.title} aria-expanded={menu} onClick={()=>setMenu(!menu)}>⋮</button>{menu&&<div className="mg-menu"><button onClick={()=>{setMenu(false);onDetail();}}>Ver detalles e historial</button>{g.canEdit&&<><button onClick={()=>{setMenu(false);onEdit();}}>Editar objetivo</button><button onClick={()=>{setMenu(false);onCancel();}}>Cancelar objetivo</button></>}</div>}</div>
    </div>
    <div className="mg-card-body"><div className={'mg-cover '+(!g.project?'mg-general-icon':'')}>{g.project?.portadaUrl?<img src={g.project.portadaUrl} alt={'Portada de '+g.project.titulo} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:<RrppIcon nombre={g.project?'libro':'proceso'} className={g.project?'h-6 w-6':'h-8 w-8'}/>}</div>
      <div className="mg-goal-content"><h3>{g.project?.titulo ?? g.title}</h3>{g.project&&<p className="mg-goal-title">{g.title}</p>}
        <div className={'mg-facts '+(!g.project?'mg-general-facts':'')}>
          {g.project&&<div><small>Proyecto / Servicio</small><strong title={g.project.autores}>#{g.project.codigo} · {g.project.servicio}</strong></div>}
          <div><small>Fecha objetivo</small><strong>{dateLabel(g.targetDate)}</strong>{['ACTIVO','EN_RIESGO'].includes(g.status)&&<span className={remaining<0?'mg-late':'mg-time'}>{due}</span>}</div>
          <div className="mg-context"><small>Situación {g.baseStatus==='ACTIVO'?'actual':'registrada'}</small><strong>{g.currentContext}</strong></div>
          <div><small>Estado</small><span className={'mg-status mg-status-'+g.status.toLowerCase()}>{statusLabels[g.status]}</span></div>
          {team&&g.source==='JEFATURA'&&<div className="mg-creator"><small>Asignado por</small><strong>{g.createdBy.nombre}</strong><span className="mg-time">{dateLabel(g.createdAt)}</span></div>}
        </div>
      </div>
      <div className="mg-card-cta">{g.project&&g.canOpenProject?<Link className="mg-secondary" to={'/proyectos/'+g.project.id+'?'+new URLSearchParams({volver:origin})}>Ver proyecto <span aria-hidden>→</span></Link>:<button className="mg-secondary" onClick={onDetail}>Ver detalles <span aria-hidden>→</span></button>}</div>
    </div>
    {g.status==='EN_RIESGO'&&<div className="mg-risk"><RrppIcon nombre="riesgo" className="h-3.5 w-3.5"/>{g.riskReasons.join(' · ')}</div>}
    {g.status==='CUMPLIDO'&&g.completedAt&&<div className="mg-result"><RrppIcon nombre="check" className="h-3.5 w-3.5"/>Cumplido el {dateLabel(g.evidence?.precision==='dia'?g.evidence.at:g.completedAt)}{g.daysEarly!==null&&<span> · {g.daysEarly>0?`${g.daysEarly} días antes`:g.daysEarly<0?`${Math.abs(g.daysEarly)} días después de la fecha objetivo`:'En la fecha objetivo'}</span>}</div>}
    {g.status==='CANCELADO'&&<p className="mg-cancel-reason">{g.cancelReason}</p>}
  </article>;
}
function Dialog({title,onClose,children,wide=false,busy=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean;busy?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null),busyRef=useRef(busy);busyRef.current=busy;
  useEffect(()=>{const prev=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();prev?.focus();};},[]);
  return <dialog ref={ref} className={'mg-dialog '+(wide?'mg-detail-dialog':'')} aria-labelledby="mg-dialog-title" onCancel={e=>{e.preventDefault();if(!busyRef.current)onClose();}}><header><div><span className="mg-kicker">OBJETIVOS DEL MES</span><h2 id="mg-dialog-title">{title}</h2></div><button disabled={busy} aria-label="Cerrar ventana" onClick={onClose}>×</button></header>{children}</dialog>;
}
function GoalForm({period,specialistId,specialistName,team,goal,onClose,onSaved}:{period:string;specialistId:string;specialistName:string;team:boolean;goal?:MonthlyGoal;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const {data:user}=useMe(),[year,month]=period.split('-').map(Number);
  const catalog=useQuery({queryKey:['monthly-goals','catalog',user?.id,specialistId],queryFn:()=>apiFetch<GoalCatalog>('/monthly-goals/catalog?'+new URLSearchParams({specialistId})),staleTime:0});
  const [form,setForm]=useState<GoalInput>({periodYear:year,periodMonth:month,projectId:goal?.projectId ?? null,title:goal?.title ?? '',description:goal?.description ?? '',goalType:goal?.goalType ?? 'GENERAL',targetProcess:goal?.targetProcess ?? null,targetWorkItemId:goal?.targetWorkItemId ?? null,targetDate:goal?.targetDate ?? new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)});
  const [reason,setReason]=useState(''),key=useRef(crypto.randomUUID()),lock=useRef(false);
  const mutation=useMutation({mutationFn:()=>apiFetch('/monthly-goals'+(goal?'/'+goal.id:''),{method:goal?'PATCH':'POST',body:JSON.stringify({...form,description:form.description?.trim()||null,...(goal?{updatedAt:goal.updatedAt,changeReason:reason}:{specialistId,idempotencyKey:key.current})})}),onSuccess:async()=>{await onSaved();onClose();}});
  const selected=catalog.data?.projects.find(p=>p.id===form.projectId);
  const field=<K extends keyof GoalInput>(k:K,v:GoalInput[K])=>setForm(f=>({...f,[k]:v}));
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(lock.current)return;lock.current=true;try{await mutation.mutateAsync();}catch{/* Error visible en el formulario. */}finally{lock.current=false;}};
  return <Dialog title={goal?'Editar objetivo':team?'Asignar objetivo a '+specialistName:'Crear mi objetivo'} onClose={onClose} busy={mutation.isPending}>
    <form className="mg-form" onSubmit={submit}><p className="mg-form-period"><RrppIcon nombre="calendario" className="h-4 w-4"/>{periodLabel(period)}<span className={'mg-source '+(team?'blue':'teal')}>{team?'Asignado por Jefatura':'Mi objetivo'}</span></p>
      {catalog.isPending?<Skeleton/>:catalog.isError?<ErrorBlock error={catalog.error} retry={()=>catalog.refetch()}/>:<>
        <div className="mg-form-grid"><label>Proyecto <small>opcional</small><select value={form.projectId ?? ''} onChange={e=>setForm(f=>({...f,projectId:e.target.value||null,goalType:e.target.value?'CIERRE_PROYECTO':'GENERAL',targetProcess:null,targetWorkItemId:null}))}><option value="">Objetivo general, sin proyecto</option>{catalog.data.projects.map(p=><option key={p.id} value={p.id}>{p.titulo} · #{p.codigo}</option>)}</select></label>
        <label>Tipo de objetivo<select value={form.goalType} onChange={e=>setForm(f=>({...f,goalType:e.target.value as GoalInput['goalType'],targetProcess:null,targetWorkItemId:null}))}>{catalog.data.types.map(t=><option key={t.id} value={t.id} disabled={!form.projectId&&t.id!=='GENERAL'}>{t.nombre}</option>)}</select></label></div>
        {selected&&<div className="mg-project-context"><strong>{selected.titulo}</strong><span>{selected.autores} · {selected.servicio}</span><span>{({en_proceso:'En proceso',retrasado:'Retrasado',stand_by:'Stand-by',pausado:'Pausado'} as Record<string,string>)[selected.estado] ?? selected.estado}{selected.fechaObjetivo?' · Fecha del proyecto: '+dateLabel(selected.fechaObjetivo):''}</span></div>}
        {form.goalType==='ALCANZAR_PROCESO'&&<label>Proceso que se quiere alcanzar<select required value={form.targetProcess ?? ''} onChange={e=>field('targetProcess',e.target.value||null)}><option value="">Seleccionar proceso</option>{catalog.data.processes.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>}
        {form.goalType==='ALCANZAR_HITO'&&<label>Hito del proyecto<select required value={form.targetWorkItemId ?? ''} onChange={e=>field('targetWorkItemId',e.target.value||null)}><option value="">Seleccionar hito pendiente</option>{catalog.data.milestones.filter(w=>w.projectId===form.projectId).map(w=><option key={w.id} value={w.id}>{w.nombre}</option>)}</select>{!catalog.data.milestones.some(w=>w.projectId===form.projectId)&&<small>No hay hitos pendientes registrados en este proyecto.</small>}</label>}
        <label>Objetivo <span className="mg-required">*</span><input autoComplete="off" required minLength={5} maxLength={250} value={form.title} onChange={e=>field('title',e.target.value)} placeholder="¿Qué resultado quieres conseguir este mes?"/></label>
        <div className="mg-form-grid"><label>Fecha objetivo <span className="mg-required">*</span><input type="date" required min={period+'-01'} value={form.targetDate} onChange={e=>field('targetDate',e.target.value)}/></label><p className="mg-form-note">{form.goalType==='GENERAL'?'Este objetivo no tiene comprobación automática. Su validación de resultados está pendiente de definición.':'PanHouse comprobará este resultado a partir de los registros del proyecto.'}</p></div>
        <label>Descripción <small>opcional</small><textarea rows={2} maxLength={2000} value={form.description ?? ''} onChange={e=>field('description',e.target.value)} placeholder="Contexto o consideraciones adicionales…"/></label>
        {goal&&<label>Motivo del ajuste <span className="mg-required">*</span><textarea required minLength={5} maxLength={1000} rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explica por qué cambia este compromiso"/></label>}
      </>}
      {mutation.isError&&<p className="mg-error" role="alert">{mutation.error.message}</p>}
      <footer><button type="button" className="mg-secondary" disabled={mutation.isPending} onClick={onClose}>Cancelar</button><button className="mg-primary" disabled={mutation.isPending||!catalog.data}>{mutation.isPending?'Guardando…':goal?'Guardar ajuste':team?'Asignar objetivo':'Crear mi objetivo'}</button></footer>
    </form>
  </Dialog>;
}
function CancelGoal({goal,onClose,onSaved}:{goal:MonthlyGoal;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [reason,setReason]=useState(''),lock=useRef(false),mutation=useMutation({mutationFn:()=>apiFetch('/monthly-goals/'+goal.id+'/cancel',{method:'POST',body:JSON.stringify({reason,updatedAt:goal.updatedAt})}),onSuccess:async()=>{await onSaved();onClose();}});
  return <Dialog title="Cancelar objetivo" onClose={onClose} busy={mutation.isPending}><form className="mg-form" onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;try{await mutation.mutateAsync();}catch{/* Error contextual. */}finally{lock.current=false;}}}><p className="mg-cancel-title">{goal.title}</p><p>El objetivo conservará su historial y el motivo de cancelación.</p><label>Motivo de cancelación<textarea required minLength={5} maxLength={1000} rows={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>{mutation.isError&&<p className="mg-error" role="alert">{mutation.error.message}</p>}<footer><button type="button" className="mg-secondary" disabled={mutation.isPending} onClick={onClose}>Volver</button><button className="mg-primary" disabled={mutation.isPending}>{mutation.isPending?'Guardando…':'Confirmar cancelación'}</button></footer></form></Dialog>;
}
const historyLabels:Record<string,string>={OBJETIVO_CREADO:'Objetivo registrado',OBJETIVO_AJUSTADO:'Compromiso ajustado',OBJETIVO_CUMPLIDO:'Cumplimiento verificado por PanHouse',OBJETIVO_NO_CUMPLIDO:'Periodo terminado sin cumplimiento registrado',OBJETIVO_CANCELADO:'Objetivo cancelado',OBJETIVO_CANCELADO_REASIGNACION:'Cancelado por reasignación del proyecto'};
const fieldLabels:Record<string,string>={title:'Objetivo',description:'Descripción',targetDate:'Fecha objetivo',projectId:'Proyecto',goalType:'Tipo',targetProcess:'Proceso',targetWorkItemId:'Hito'};
function HistoryDetail({id,onClose,onEdit,onCancel,team,origin}:{id:string;onClose:()=>void;onEdit:(g:MonthlyGoal)=>void;onCancel:(g:MonthlyGoal)=>void;team:boolean;origin:string}) {
  const {data:user}=useMe(),q=useQuery({queryKey:['monthly-goals','history',user?.id,id],queryFn:()=>apiFetch<GoalHistory>('/monthly-goals/'+id),staleTime:0});
  return <Dialog title="Detalle del objetivo" onClose={onClose} wide>{q.isPending?<div className="mg-form"><Skeleton/></div>:q.isError?<ErrorBlock error={q.error} retry={()=>q.refetch()}/>:<div className="mg-detail-content"><GoalCard goal={q.data.goal} team={team} origin={origin} onDetail={()=>{}} onEdit={()=>onEdit(q.data.goal)} onCancel={()=>onCancel(q.data.goal)}/>{q.data.goal.description&&<p className="mg-description">{q.data.goal.description}</p>}
    <div className="mg-detail-meta"><span>{q.data.goal.targetLabel}</span><span>Creado por {q.data.goal.createdBy.nombre}</span></div>{q.data.goal.goalType==='GENERAL'&&<p className="mg-neutral-note">Objetivo cualitativo: PanHouse aún no dispone de una regla para acreditar su cumplimiento.</p>}
    <h3 className="mg-history-title">Historial del compromiso</h3><ol className="mg-history">{q.data.events.map(e=><li key={e.id}><span className="mg-history-dot"/><div><strong>{historyLabels[e.accion] ?? e.accion}</strong><small>{e.actor} · {dateLabel(e.at)} · {new Intl.DateTimeFormat('es',{hour:'2-digit',minute:'2-digit',timeZone:'America/Caracas'}).format(new Date(e.at))}</small>{typeof e.detalles?.motivo==='string'&&<p>{e.detalles.motivo}</p>}{e.detalles?.changes&&typeof e.detalles.changes==='object'?<dl>{Object.entries(e.detalles.changes as Record<string,{anterior:unknown;nuevo:unknown}>).map(([k,v])=><div key={k}><dt>{fieldLabels[k] ?? k}</dt><dd>{String(v.anterior ?? 'Sin registro')} → {String(v.nuevo ?? 'Sin registro')}</dd></div>)}</dl>:null}</div></li>)}</ol></div>}</Dialog>;
}
function TeamTable({data,selected,onSelect}:{data:TeamGoals;selected:string|null;onSelect:(id:string)=>void}) {
  return <section className="mg-team" aria-label="Resumen del equipo"><header><h2>Resumen del equipo</h2><span>{data.specialists.length} Especialistas · {periodLabel(data.period)}</span></header>
    <div className="mg-team-desktop"><table><thead><tr><th>Especialista</th><th>Total</th><th>Jefatura</th><th>Propios</th><th>En curso</th><th>En riesgo</th><th>Completados</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{data.specialists.map(p=><tr key={p.id} className={selected===p.id?'mg-selected':''}><th scope="row"><button onClick={()=>onSelect(p.id)}><span className="mg-avatar">{initials(p.nombre)}</span>{p.nombre}</button></th><td>{p.summary.total}</td><td className="mg-blue-text">{p.summary.assigned}</td><td>{p.summary.own}</td><td>{p.summary.active}</td><td className={p.summary.risk?'mg-amber-text':''}>{p.summary.risk}</td><td className="mg-green-text">{p.summary.completed}</td><td><button className="mg-secondary" aria-label={'Ver objetivos de '+p.nombre} onClick={()=>onSelect(p.id)}>Ver objetivos →</button></td></tr>)}</tbody></table></div>
    <div className="mg-team-mobile">{data.specialists.map(p=><button key={p.id} className={'mg-person '+(selected===p.id?'mg-selected':'')} onClick={()=>onSelect(p.id)} aria-label={'Ver objetivos de '+p.nombre}><span className="mg-avatar">{initials(p.nombre)}</span><span><strong>{p.nombre}</strong><small>{p.summary.total} objetivos · {p.summary.assigned} Jefatura · {p.summary.own} propios</small>{p.summary.risk>0&&<small className="mg-amber-text">{p.summary.risk} en riesgo</small>}</span><span aria-hidden>→</span></button>)}</div>
    {!data.specialists.length&&<div className="mg-empty"><h3>No hay Especialistas activos</h3><p>El equipo aparecerá aquí cuando tenga usuarios Especialistas activos.</p></div>}
  </section>;
}

export function MonthlyGoalsPage({team=false}:{team?:boolean}) {
  const {data:user}=useMe(),cache=useQueryClient(),[params,setParams]=useSearchParams(),location=useLocation();
  const rawPeriod=params.get('periodo'),period=rawPeriod&&/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/.test(rawPeriod)?rawPeriod:currentPeriod();
  const selected=team?params.get('especialista'):user?.id ?? null,rawTab=params.get('goalTab'),tab:GoalTab=tabs.some(t=>t.id===rawTab)?rawTab as GoalTab:'all';
  const page=Number(params.get('goalPage'))>0?Number(params.get('goalPage')):1,statusFilter=params.get('goalStatus') ?? '';
  const [editor,setEditor]=useState<MonthlyGoal|'new'|null>(null),[cancel,setCancel]=useState<MonthlyGoal|null>(null),[detail,setDetail]=useState<string|null>(null),[notice,setNotice]=useState('');
  const panelRef=useRef<HTMLElement>(null),[mobile,setMobile]=useState(()=>window.matchMedia('(max-width:639px)').matches);
  useEffect(()=>{const mq=window.matchMedia('(max-width:639px)'),change=()=>setMobile(mq.matches);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
  useEffect(()=>{if(!team||!selected||!mobile)return;const previous=document.activeElement as HTMLElement|null;panelRef.current?.querySelector<HTMLElement>('h2')?.focus();return()=>previous?.focus();},[team,selected,mobile]);
  const allowed=team?user?.rol==='jefe_area':user?.rol==='especialista';
  const update=(fields:Record<string,string>)=>setParams(prev=>{const next=new URLSearchParams(prev);for(const[k,v]of Object.entries(fields)){if(v)next.set(k,v);else next.delete(k);}if(!('goalPage'in fields))next.delete('goalPage');return next;});
  const teamQuery=useQuery({queryKey:['monthly-goals','team',user?.id,period],queryFn:()=>apiFetch<TeamGoals>('/monthly-goals/team?'+new URLSearchParams({period})),enabled:allowed&&team,staleTime:0,refetchInterval:60000});
  const ownSummary=useQuery({queryKey:['monthly-goals','summary',user?.id,period],queryFn:()=>apiFetch<{summary:GoalSummary;readOnly:boolean}>('/monthly-goals/summary?'+new URLSearchParams({period})),enabled:allowed&&!team,staleTime:0,refetchInterval:60000});
  const filter=new URLSearchParams({period,page:String(page),pageSize:'20'});
  if(selected)filter.set('specialistId',selected);
  if(tab==='assigned'||tab==='own')filter.set('source',tab==='assigned'?'JEFATURA':'ESPECIALISTA');
  const statuses:Record<string,string>={active:'ACTIVO',risk:'EN_RIESGO',completed:'CUMPLIDO'};
  if(statuses[tab])filter.set('status',statuses[tab]);else if(['NO_CUMPLIDO','CANCELADO'].includes(statusFilter))filter.set('status',statusFilter);
  const list=useQuery({queryKey:['monthly-goals','list',user?.id,filter.toString()],queryFn:()=>apiFetch<GoalList>('/monthly-goals?'+filter),enabled:allowed&&!!selected,staleTime:0,refetchInterval:60000});
  const specialist=teamQuery.data?.specialists.find(p=>p.id===selected),summary=team?teamQuery.data?.summary:ownSummary.data?.summary,detailSummary=team?specialist?.summary:summary;
  const readOnly=period<currentPeriod(),origin=location.pathname+location.search;
  useEffect(()=>{setEditor(null);setDetail(null);setCancel(null);},[period,selected]);
  useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(id);},[notice]);
  const saved=async()=>{await Promise.all([cache.invalidateQueries({queryKey:['monthly-goals']}),cache.invalidateQueries({queryKey:['notificaciones']})]);setNotice('El compromiso quedó registrado.');};
  const content=<div className="mg-page">
    {!team&&<SpecialistSidebarNav mobile/>}
    <header className="mg-header"><div><span className="mg-kicker">{team?'JEFATURA · SEGUIMIENTO':'ESPECIALISTA · OPERACIÓN EDITORIAL'}</span><h1>Objetivos del mes{team&&<span> · Equipo</span>}</h1><p>{team?'Define y da seguimiento a los compromisos mensuales del equipo editorial.':'Tus compromisos para este mes y el seguimiento de su avance.'}</p></div><div className="mg-header-right"><TopBar compacto/><MonthSelector period={period} onChange={p=>update({periodo:p,goalTab:'',goalStatus:''})}/></div></header>
    {team&&<nav className="mg-subnav" aria-label="Vistas de Seguimiento"><Link to="/?vista=seguimiento">Visión general</Link><Link aria-current="page" to={'/?'+new URLSearchParams({vista:'seguimiento',subvista:'objetivos',periodo:period})}>Objetivos del mes</Link></nav>}
    {readOnly&&<p className="mg-history-banner"><RrppIcon nombre="actividad" className="h-4 w-4"/>Periodo histórico · Consulta los compromisos y resultados registrados.</p>}
    {(team?teamQuery:ownSummary).isPending?<Skeleton summary/>:(team?teamQuery:ownSummary).isError?<ErrorBlock error={(team?teamQuery:ownSummary).error!} retry={()=>{if(team)void teamQuery.refetch();else void ownSummary.refetch();}}/>:summary&&<Summary data={summary} team={team}/>}
    {summary&&(summary.unmet>0||summary.cancelled>0)&&<p className="mg-other-results">También en este periodo: <button onClick={()=>update({goalStatus:statusFilter==='NO_CUMPLIDO'?'':'NO_CUMPLIDO',goalTab:'all'})}>{summary.unmet} no cumplidos</button><span>·</span><button onClick={()=>update({goalStatus:statusFilter==='CANCELADO'?'':'CANCELADO',goalTab:'all'})}>{summary.cancelled} cancelados</button></p>}
    {team&&teamQuery.data&&<TeamTable data={teamQuery.data} selected={selected} onSelect={id=>update({especialista:id,goalTab:'',goalStatus:''})}/>}
    {(!team||selected)&&<section ref={panelRef} role={team&&mobile?'dialog':'region'} aria-modal={team&&mobile?true:undefined} className={'mg-goals-panel '+(team?'mg-specialist-detail':'')} aria-label={team?'Objetivos del Especialista':'Mis objetivos del mes'} onKeyDown={e=>{if(!team||!mobile)return;if(e.key==='Escape')update({especialista:''});if(e.key==='Tab'){const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea')].filter(n=>n.getClientRects().length>0),first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      {team&&<header className="mg-detail-header"><div><span className="mg-kicker">DETALLE DEL ESPECIALISTA</span><h2 tabIndex={-1}>{specialist?.nombre ?? 'Especialista seleccionado'}</h2><p>Compromisos de {periodLabel(period)}</p></div><button aria-label="Cerrar detalle del Especialista" className="mg-close-detail" onClick={()=>update({especialista:''})}>×</button></header>}
      <div className="mg-list-controls"><GoalTabs tab={tab} onChange={t=>update({goalTab:t,goalStatus:''})} summary={detailSummary} team={team}/>{!readOnly&&(!team||specialist)&&<button className="mg-primary" onClick={()=>setEditor('new')}>＋ {team?'Asignar objetivo':'Nuevo objetivo'}</button>}</div>
      {statusFilter&&<div className="mg-filter-note">Mostrando {statusFilter==='CANCELADO'?'cancelados':'no cumplidos'}<button onClick={()=>update({goalStatus:''})}>Quitar filtro ×</button></div>}
      {list.isPending?<Skeleton/>:list.isError?<ErrorBlock error={list.error} retry={()=>list.refetch()}/>:list.data&&<>
        {!list.data.items.length?<div className="mg-empty"><span className="mg-empty-icon"><RrppIcon nombre="proceso" className="h-7 w-7"/></span><h3>{tab==='all'&&!statusFilter?(team?`${specialist?.nombre ?? 'Este Especialista'} no tiene objetivos registrados`:'No tienes objetivos registrados'):'No hay objetivos con este filtro'}</h3><p>{tab==='all'&&!statusFilter?`Compromisos de ${periodLabel(period)}. Define el próximo resultado que quieres conseguir.`:'Prueba otra vista para consultar los compromisos del periodo.'}</p>{!readOnly&&tab==='all'&&!statusFilter&&(!team||specialist)&&<button className="mg-primary" onClick={()=>setEditor('new')}>{team?'Asignar objetivo':'Crear mi objetivo'}</button>}</div>:
        <div className="mg-list">{list.data.items.map(g=><GoalCard key={g.id} goal={g} team={team} origin={origin} onDetail={()=>setDetail(g.id)} onEdit={()=>setEditor(g)} onCancel={()=>setCancel(g)}/>)}</div>}
        {list.data.pages>1&&<div className="mg-pagination"><span>{list.data.total} objetivos</span><button className="mg-secondary" aria-label="Página anterior de objetivos" disabled={list.data.page<=1} onClick={()=>update({goalPage:String(list.data!.page-1)})}>‹</button><span>{list.data.page} / {list.data.pages}</span><button className="mg-secondary" aria-label="Página siguiente de objetivos" disabled={list.data.page>=list.data.pages} onClick={()=>update({goalPage:String(list.data!.page+1)})}>›</button></div>}
      </>}
    </section>}
    {team&&!selected&&teamQuery.data?.specialists.length!==0&&<p className="mg-team-hint"><RrppIcon nombre="persona" className="h-4 w-4"/>Selecciona un Especialista para consultar sus compromisos o asignarle un objetivo.</p>}
    <p className="mg-footnote">Los resultados verificables se actualizan con los registros del proyecto.<button onClick={()=>{void list.refetch();if(team)void teamQuery.refetch();else void ownSummary.refetch();}}>Actualizar</button></p>
    {editor&&selected&&<GoalForm key={(editor==='new'?'new':editor.id)+period+selected} period={period} specialistId={selected} specialistName={specialist?.nombre ?? user?.nombre ?? 'Especialista'} team={team} goal={editor==='new'?undefined:editor} onClose={()=>setEditor(null)} onSaved={saved}/>}
    {cancel&&<CancelGoal goal={cancel} onClose={()=>setCancel(null)} onSaved={saved}/>}
    {detail&&!editor&&!cancel&&<HistoryDetail id={detail} team={team} origin={origin} onClose={()=>setDetail(null)} onEdit={g=>{setDetail(null);setEditor(g);}} onCancel={g=>{setDetail(null);setCancel(g);}}/>}
    {notice&&<p className="mg-toast" role="status">{notice}</p>}
  </div>;
  if(!allowed)return <p role="alert">No tienes acceso a esta vista de objetivos.</p>;
  return team?content:<CrmSidebarLayout sidebarCompact sidebarWidth={216} sidebarBreakpoint="lg" nav={<SpecialistSidebarNav/>} logo={PRODUCTION_LOGO} footer={RRPP_FOOTER} contentMaxWidth="max-w-[1600px]" contentClassName="mg-container">{content}</CrmSidebarLayout>;
}

export function MonthlyGoalsHomeSummary() {
  const {data:user}=useMe(),period=currentPeriod(),query=useQuery({queryKey:['monthly-goals','summary',user?.id,period],queryFn:()=>apiFetch<{summary:GoalSummary}>('/monthly-goals/summary?'+new URLSearchParams({period})),enabled:user?.rol==='especialista',staleTime:15000});
  return <div className="ei-goals">{query.isPending?<span role="status">Cargando compromisos…</span>:query.isError?<><p role="alert">No pudimos consultar tus objetivos.</p><button onClick={()=>query.refetch()}>Reintentar</button></>:<><span className="ei-goals-icon"><RrppIcon nombre="proceso" className="h-6 w-6"/></span><strong>{query.data.summary.total?`${query.data.summary.completed} cumplidos de ${query.data.summary.total} objetivos`:'Aún no tienes objetivos este mes'}</strong><p>{query.data.summary.total?`${query.data.summary.assigned} asignados por Jefatura · ${query.data.summary.own} propios · ${query.data.summary.risk} en riesgo`:'Define tus compromisos y consulta los que te asigne Jefatura.'}</p></>}<Link className="ei-secondary" to="/?vista=objetivos">Ver objetivos del mes →</Link></div>;
}
