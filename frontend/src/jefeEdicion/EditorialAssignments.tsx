import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import type {EditorialAssignmentTab, EditorialIntervention, EditorialLoadSummary} from '../../../shared/editorialChief';
import {editorialKey, fetchEditorialAssignments, fetchEditorialTeam} from './jefeEdicionApi';
import {EditorialCover, EditorialEmpty, EditorialPanel, editorialDate} from './EditorialParts';
import './editorialChief.css';
import './editorialAssignments.css';

export const ASSIGNMENT_TABS: [EditorialAssignmentTab,string][]=[['unassigned','Por asignar'],['editing','En edición'],['waiting','En espera'],['overdue','Vencidas'],['all','Todas']];
export function EditorialRowsSkeleton({label='Cargando intervenciones'}:{label?:string}) {
  return <div className="ea-skeleton" role="status" aria-label={label}>{[0,1,2,3].map(i=><div key={i}/>)}</div>;
}
export function EditorialAssignmentRows({items,onOpen,tab}:{items:EditorialIntervention[];onOpen:(id:string)=>void;tab:EditorialAssignmentTab}) {
  return <div className="ea-table-wrap"><table className="ea-table"><thead><tr>{['Proyecto / Autor','Intervención','Servicio','Volumen','Fecha requerida','Solicitado por','Acción'].map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{items.map(i=><tr key={i.id}>
    <td data-label="Proyecto / Autor"><div className="ec-project"><EditorialCover/><span><strong>{i.title}</strong><small>{i.authors}</small></span></div></td>
    <td data-label="Intervención"><span>{i.label}</span>{!i.needsAssignment&&<small className={'ea-row-state '+(i.overdue?'ec-deadline-overdue':'')}>{i.state}{i.editor?' · '+i.editor:''}</small>}</td>
    <td data-label="Servicio"><span className="ea-service">{i.serviceCode??i.service}</span>{i.subtype&&<small className="ea-row-state">{i.subtype}</small>}</td>
    <td data-label="Volumen">{i.volume??'Sin volumen registrado'}</td>
    <td data-label="Fecha requerida" className={i.overdue?'ec-deadline-overdue':''}>{editorialDate(i.dueDate)}{i.waitingOn&&<small className="ea-row-state">SLA del Editor suspendido</small>}</td>
    <td data-label="Solicitado por">{i.requestedBy??'Sin solicitante registrado'}{i.requestedByRole&&<small className="ea-row-state">{i.requestedByRole==='especialista'?'Especialista':i.requestedByRole}</small>}</td>
    <td data-label="Acción"><button className="ec-primary" onClick={()=>onOpen(i.id)}>{i.needsAssignment?'Asignar':i.overdue||tab==='overdue'?'Ver seguimiento':'Ver asignación'}</button></td>
  </tr>)}</tbody></table></div>;
}
export function EditorialTeamCards({data,onLoad,onOpen}:{data:EditorialLoadSummary;onLoad:(id:string)=>void;onOpen:(id:string)=>void}) {
  const [page,setPage]=useState(1);const pages=Math.max(1,Math.ceil(data.editors.length/6)),current=Math.min(page,pages);
  if(!data.editors.length)return <EditorialEmpty>No hay Editores elegibles.</EditorialEmpty>;
  return <><div className="ea-team-grid">{data.editors.slice((current-1)*6,current*6).map((e,n)=><article key={e.id} className="ea-editor-card"><header><span className={'ec-avatar ec-avatar-'+n%4}>{e.name.split(/\s+/).slice(0,2).map(w=>w[0]).join('')}</span><div><h3>{e.name}</h3><small>{e.activeAssigned} asignadas · {e.waitingThirdParty} en espera</small></div></header>
    <dl className="ea-load-metrics"><div><dd>{e.actionableNow}</dd><dt>Accionables</dt></div><div><dd>{e.dueThisWeek}</dd><dt>Esta semana</dt></div><div className={e.overdue?'ea-overdue':''}><dd>{e.overdue}</dd><dt>Vencidas</dt></div></dl>
    <h4>Próximas entregas</h4>{e.nextDeliveries.length?<ul>{e.nextDeliveries.map(d=><li key={d.id}><button onClick={()=>onOpen(d.id)}><span>{d.title} · {d.label}</span><time className={d.overdue?'ec-deadline-overdue':''}>{editorialDate(d.dueDate)}</time></button></li>)}</ul>:<p className="ea-no-deadline">Sin entregas con fecha exigible.</p>}
    <button className="ea-full-load" onClick={()=>onLoad(e.id)}>Ver carga completa →</button>
  </article>)}</div>{pages>1&&<div className="ec-pagination"><button disabled={current===1} onClick={()=>setPage(current-1)}>Editores anteriores</button><span>{current} / {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>Más Editores</button></div>}</>;
}
function SelectFilter({label,value,options,onChange}:{label:string;value:string;options:{id:string;name:string}[];onChange:(value:string)=>void}) {
  return <label>{label}<select value={value} onChange={e=>onChange(e.target.value)}><option value="">Todos</option>{options.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>;
}
export function EditorialAssignments({onOpen,onLoad}:{onOpen:(id:string)=>void;onLoad:(id:string)=>void}) {
  const [params,setParams]=useSearchParams(),[search,setSearch]=useState(params.get('search')??''),[filtersOpen,setFiltersOpen]=useState(false);
  const tab=ASSIGNMENT_TABS.find(([id])=>id===params.get('tab'))?.[0]??'unassigned';
  const update=(key:string,value:string)=>setParams(p=>{value?p.set(key,value):p.delete(key);p.delete('page');if(key==='tab'&&value==='unassigned')p.delete('editor');return p;});
  const urlSearch=params.get('search')??'';
  useEffect(()=>setSearch(urlSearch),[urlSearch]);
  useEffect(()=>{if(search===urlSearch)return;const timer=setTimeout(()=>update('search',search),300);return()=>clearTimeout(timer);},[search,urlSearch]);
  const queryParams=new URLSearchParams({tab,page:params.get('page')??'1',pageSize:params.get('pageSize')??'10',sort:params.get('sort')??'due'});
  for(const key of ['search','service','interventionType','specialist','editor','date','status'])if(params.get(key))queryParams.set(key,params.get(key)!);
  const q=useQuery({queryKey:[...editorialKey,'assignments',queryParams.toString()],queryFn:()=>fetchEditorialAssignments(queryParams),placeholderData:previous=>previous});
  const team=useQuery({queryKey:[...editorialKey,'team'],queryFn:fetchEditorialTeam});
  const options=q.data?.options,rows=q.data?.items??[];
  const clear=()=>{setSearch('');setParams(p=>{for(const key of ['search','service','interventionType','specialist','editor','date','status','page'])p.delete(key);return p;});};
  return <div className="ea-module">
    <details className="ea-guide"><summary>ⓘ Guía de asignación</summary><p>Asignar cambia el Editor del proyecto y de sus intervenciones. Compara trabajo accionable, vencidas y entregas esta semana. Las esperas de autor, Especialista o reanudación se muestran aparte.</p><p>La sugerencia prioriza menos intervenciones accionables; después, menos vencidas y menos entregas esta semana. No mide esfuerzo ni capacidad. Puedes elegir otro Editor. La asignación se realiza sólo al confirmar.</p></details>
    <div className="ea-tabs" role="tablist" aria-label="Estado de asignaciones">{ASSIGNMENT_TABS.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} aria-controls="ea-results" onClick={()=>update('tab',id)}>{label} <span>{q.data?.counts[id]??'—'}</span></button>)}</div>
    <div className="ea-filterbar"><label className="ea-search"><span>Buscar</span><input type="search" placeholder="Buscar por proyecto, autor, capítulo o Editor…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="ea-filter-toggle ec-secondary" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(true)}>Filtros</button>
      <div className={'ea-filters '+(filtersOpen?'is-open':'')} aria-label="Filtros de asignaciones">{filtersOpen&&<button className="ea-filter-close" onClick={()=>setFiltersOpen(false)}>Cerrar filtros ×</button>}
        <SelectFilter label="Servicio" value={params.get('service')??''} options={options?.services??[]} onChange={v=>update('service',v)}/>
        <SelectFilter label="Tipo de intervención" value={params.get('interventionType')??''} options={options?.interventionTypes??[]} onChange={v=>update('interventionType',v)}/>
        <label>Fecha requerida<input type="date" value={params.get('date')??''} onChange={e=>update('date',e.target.value)}/></label>
        <details className="ea-more-filters"><summary>Más filtros</summary><div><SelectFilter label="Especialista solicitante" value={params.get('specialist')??''} options={options?.specialists??[]} onChange={v=>update('specialist',v)}/>
          <SelectFilter label="Estado" value={params.get('status')??''} options={(options?.states??[]).map(s=>({id:s,name:s}))} onChange={v=>update('status',v)}/>
          {tab!=='unassigned'&&<SelectFilter label="Editor" value={params.get('editor')??''} options={options?.editors??[]} onChange={v=>update('editor',v)}/>}</div></details>
        <button className="ea-clear" onClick={clear}>Limpiar filtros</button>{filtersOpen&&<button className="ec-primary ea-filter-done" onClick={()=>setFiltersOpen(false)}>Ver resultados</button>}
      </div>
    </div>
    <section id="ea-results" role="tabpanel" aria-busy={q.isFetching}>
      <EditorialPanel title={tab==='unassigned'?'Solicitudes e intervenciones por asignar':ASSIGNMENT_TABS.find(([id])=>id===tab)![1]} icon="equipo"><p className="ea-section-caption">{tab==='unassigned'?'Trabajos listos para ser asignados a un Editor.':'Intervenciones registradas y responsabilidad actual del equipo.'}</p>
        {q.isError?<p className="ec-empty" role="alert">No se pudieron cargar las intervenciones. <button className="ea-link" onClick={()=>q.refetch()}>Reintentar lista</button></p>:q.isPending?<EditorialRowsSkeleton/>:rows.length?<EditorialAssignmentRows items={rows} onOpen={onOpen} tab={tab}/>:<EditorialEmpty>{tab==='unassigned'?<>No hay intervenciones pendientes de asignación.<br/>Las nuevas solicitudes de Editor aparecerán aquí.</>:'No hay intervenciones con estos filtros.'}</EditorialEmpty>}
        {q.data&&!q.isError&&<div className="ea-list-footer"><label>Por página<select value={params.get('pageSize')??'10'} onChange={e=>update('pageSize',e.target.value)}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label>Ordenar<select value={params.get('sort')??'due'} onChange={e=>update('sort',e.target.value)}><option value="due">Fecha requerida</option><option value="oldest">Solicitud más antigua</option><option value="project">Proyecto</option></select></label><span>{q.data.total} intervenciones</span><button disabled={q.isFetching||q.data.page<=1} onClick={()=>setParams(p=>{p.set('page',String(q.data!.page-1));return p;})}>‹</button><span>{q.data.page} / {q.data.pages}</span><button disabled={q.isFetching||q.data.page>=q.data.pages} onClick={()=>setParams(p=>{p.set('page',String(q.data!.page+1));return p;})}>›</button></div>}
      </EditorialPanel>
    </section>
    <EditorialPanel title="Carga del equipo de edición" icon="equipo"><p className="ea-section-caption">Intervenciones activas y próximas entregas por Editor.</p>{team.isPending?<EditorialRowsSkeleton label="Cargando carga del equipo"/>:team.isError?<p role="alert" className="ec-empty">No se pudo cargar el equipo. <button className="ea-link" onClick={()=>team.refetch()}>Reintentar carga</button></p>:<EditorialTeamCards data={team.data} onLoad={onLoad} onOpen={onOpen}/>}</EditorialPanel>
  </div>;
}
