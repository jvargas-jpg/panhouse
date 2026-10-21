import type {CreativeWorkFilters,CreativeWorkItem} from '../../../shared/creativeLeader';
/** Local route mapping; the API never supplies executable URLs. */
export function creativeWorkRoute(item:CreativeWorkItem,returnTo:string){
 const params=new URLSearchParams(returnTo.split('?')[1]??'');
 params.set('vista','mi-trabajo');params.set('trabajo',item.creativeProcessId);params.set('proyecto',item.project.id);params.set('workItem',item.workItemId);params.set('volver',returnTo);
 if(item.actionable){params.set('accion',item.type);if(item.conceptId)params.set('concepto',item.conceptId);}else{params.delete('accion');params.delete('concepto');}
 return '/?'+params;
}
export function creativeWorkFilters(params:URLSearchParams):CreativeWorkFilters{
 const keys=['tipo','estado','servicio','fecha','search','alcance','orden','pagina','pageSize'];
 return Object.fromEntries(keys.filter(k=>params.has(k)).map(k=>[k,['pagina','pageSize'].includes(k)?Number(params.get(k)):params.get(k)])) as CreativeWorkFilters;
}
