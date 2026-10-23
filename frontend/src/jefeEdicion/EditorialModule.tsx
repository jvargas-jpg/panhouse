import {useQuery} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import type {EditorialDashboard} from '../../../shared/editorialChief';
import {editorialKey,fetchEditorialList} from './jefeEdicionApi';
import {EditorialPanel,EditorialTeam,EditorialRows,EditorialEmpty,EditorialDistribution} from './EditorialParts';
export function EditorialModule({active,dashboard,onOpen,onLoad}:{active:string;dashboard:EditorialDashboard;onOpen:(id:string)=>void;onLoad:(id:string)=>void}){
 const [params,setParams]=useSearchParams();
 const filter=active==='asignaciones'?'unassigned':params.get('filter')??'all';
 const search=params.get('search')??'',page=params.get('page')??'1';const queryParams=new URLSearchParams({filter,search,page});
 const q=useQuery({queryKey:[...editorialKey,'list',active,queryParams.toString()],queryFn:()=>fetchEditorialList(queryParams),enabled:active!=='indicadores-edicion'});const rows=q.data?.items??[];
 if(active==='indicadores-edicion')return <EditorialPanel title="Distribución operativa de Edición"><EditorialDistribution data={dashboard.interventionDistribution}/><p className="ec-empty">Corte actual. Las entregas históricas, producción por Editor y récord general corresponden a la siguiente fase de Indicadores.</p></EditorialPanel>;
 return <div className="ec-module">
  {active==='asignaciones'&&<EditorialPanel title="Carga del equipo de edición"><EditorialTeam data={dashboard} onLoad={onLoad} all/></EditorialPanel>}
  <div className="ec-filters"><label>Buscar proyecto o autor<input type="search" value={search} onChange={e=>setParams(p=>{p.set('search',e.target.value);p.delete('page');return p;})}/></label></div>
  <EditorialPanel title={active==='asignaciones'?'Intervenciones listas para asignar':'Intervenciones de Edición'}>
  {q.isPending?<p className="ec-empty" role="status">Cargando…</p>:q.isError?<p className="ec-empty" role="alert">{q.error.message} <button onClick={()=>q.refetch()}>Reintentar</button></p>:!rows.length?<EditorialEmpty>{active==='asignaciones'?'No hay intervenciones pendientes de asignación.':'No hay intervenciones con estos filtros.'}</EditorialEmpty>:<EditorialRows items={rows} onOpen={onOpen}/>}
  {q.data&&q.data.pages>1&&<div className="ec-pagination"><button disabled={q.data.page===1} onClick={()=>setParams(p=>{p.set('page',String(q.data!.page-1));return p;})}>Anterior</button><span>{q.data.page} / {q.data.pages} · {q.data.total} intervenciones</span><button disabled={q.data.page>=q.data.pages} onClick={()=>setParams(p=>{p.set('page',String(q.data!.page+1));return p;})}>Siguiente</button></div>}
  </EditorialPanel>
 </div>;
}
