import type {CreativeRequestFilters,CreativeRequestSummary} from '../../../shared/creativeRequests';
export function creativeRequestFilters(params:URLSearchParams):CreativeRequestFilters{
 const keys=['status','service','specialist','search','date','from','to','page','pageSize'];
 return Object.fromEntries(keys.filter(k=>params.has(k)).map(k=>[k,['page','pageSize'].includes(k)?Number(params.get(k)):params.get(k)])) as CreativeRequestFilters;
}
export function creativeRequestWorkRoute(request:CreativeRequestSummary,returnTo:string){
 if(!request.canOpenWork||!request.creativeProcessId||!request.generatedWorkItemId)return null;
 const params=new URLSearchParams(returnTo.split('?')[1]);params.set('vista','solicitudes');params.set('selectedRequest',request.id);params.set('trabajo',request.creativeProcessId);params.set('workItem',request.generatedWorkItemId);params.set('proyecto',request.project.id);params.set('volver',returnTo);return '/?'+params;
}
