import type {CreativePortfolioFilters,CreativeProjectSummary} from '../../../shared/creativePortfolio';
export function creativePortfolioFilters(params:URLSearchParams):CreativePortfolioFilters{
 const keys=['search','service','creativeState','specialist','scope','page','pageSize','sort'];
 return Object.fromEntries(keys.filter(k=>params.has(k)).map(k=>[k,['page','pageSize'].includes(k)?Number(params.get(k)):params.get(k)])) as CreativePortfolioFilters;
}
export function portfolioWorkRoute(action:NonNullable<CreativeProjectSummary['currentWorkItem']>,projectId:string,returnTo:string){
 const params=new URLSearchParams(returnTo.split('?')[1]??'');params.set('vista','proyectos-creativos');params.set('selectedProject',projectId);
 params.set('trabajo',action.creativeProcessId);params.set('proyecto',projectId);params.set('workItem',action.workItemId);params.set('accion',action.type);params.set('volver',returnTo);
 if(action.conceptId)params.set('concepto',action.conceptId);else params.delete('concepto');return '/?'+params;
}
