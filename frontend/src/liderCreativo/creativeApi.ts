import type {CreativePortfolioFilters,CreativePortfolioPage,CreativeProjectDetail,CreativePortfolioConcept,CreativeProjectSummary} from '../../../shared/creativePortfolio';
import type {CreativeRequestFilters,CreativeRequestPage,CreativeRequestDetail} from '../../../shared/creativeRequests';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import type {CreativeActivity,CreativeDashboard,CreativeWorkDetail,CreativeWorkFilters,CreativeWorkPage} from '../../../shared/creativeLeader';
import {apiFetch} from '../lib/api';
import {useMe} from '../auth/useAuth';
export function useCreativeDashboard(order='accion',enabled=true){
  const {data:user}=useMe();return useQuery({queryKey:['creative-leader',user?.id,'dashboard',order],
    queryFn:()=>apiFetch<CreativeDashboard>('/direccion-creativa/inicio?orden='+order),enabled:enabled&&user?.rol==='lider_creativo',staleTime:15000});
}
export function useCreativeActivity(enabled:boolean){
  const {data:user}=useMe();return useQuery({queryKey:['creative-leader',user?.id,'activity'],
    queryFn:()=>apiFetch<{items:CreativeActivity[]}>('/direccion-creativa/inicio/actividad'),enabled:enabled&&user?.rol==='lider_creativo',staleTime:15000});
}
export function useCreativeDetail(id:string){
  const {data:user}=useMe();return useQuery({queryKey:['creative-leader',user?.id,'detail',id],
    queryFn:()=>apiFetch<CreativeWorkDetail>('/direccion-creativa/'+id+'/operacion'),enabled:!!id&&user?.rol==='lider_creativo'});
}
export function useCreativeCommand(){
  const cache=useQueryClient();return useMutation({mutationFn:({path,body,method='PATCH'}:{path:string;body:unknown;method?:'PATCH'|'POST'})=>apiFetch(path,{method,body:JSON.stringify(body)}),
    onSuccess:()=>{for(const key of [['creative-leader'],['direcciones-creativas'],['direccion-creativa'],['diseno'],['proyecto'],['ficha-viva'],['mi-trabajo'],['notificaciones'],['solicitudes'],['solicitud'],['especialista-inicio']])void cache.invalidateQueries({queryKey:key});}});
}

export function useCreativeRequests(filters:CreativeRequestFilters,enabled=true){
 const {data:user}=useMe(),params=new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)]));
 return useQuery({queryKey:['creative-leader',user?.id,'requests',filters],queryFn:()=>apiFetch<CreativeRequestPage>('/direccion-creativa/solicitudes?'+params),enabled:enabled&&user?.rol==='lider_creativo',staleTime:15000});
}
export function useCreativeRequestDetail(id:string){
 const {data:user}=useMe();return useQuery({queryKey:['creative-leader',user?.id,'request-detail',id],queryFn:()=>apiFetch<CreativeRequestDetail>('/direccion-creativa/solicitudes/'+id),enabled:!!id&&user?.rol==='lider_creativo',staleTime:15000});
}
export function useCreativeRequestDecision(){
 const cache=useQueryClient();return useMutation({mutationFn:({id,decision,reason}:{id:string;decision:'accept'|'reject';reason?:string})=>apiFetch('/direccion-creativa/solicitudes/'+id+'/'+(decision==='accept'?'aceptar':'rechazar'),{method:'POST',body:JSON.stringify(decision==='accept'?{}:{reason})}),
 onSettled:async()=>{await Promise.all([['creative-leader'],['direcciones-creativas'],['mi-trabajo'],['solicitudes'],['solicitud'],['especialista-inicio'],['especialista-inicio-actividad'],['proyecto'],['ficha-viva'],['notificaciones']].map(queryKey=>cache.invalidateQueries({queryKey})));}});
}

export function useCreativeWork(filters:CreativeWorkFilters,enabled=true){
 const {data:user}=useMe(),params=new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)]));
 return useQuery({queryKey:['creative-leader',user?.id,'work',filters],queryFn:()=>apiFetch<CreativeWorkPage>('/direccion-creativa/mi-trabajo?'+params),enabled:enabled&&user?.rol==='lider_creativo',staleTime:15000});
}

export function useCreativePortfolio(filters:CreativePortfolioFilters,enabled=true){
 const {data:user}=useMe(),params=new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)]));
 return useQuery({queryKey:['creative-leader',user?.id,'portfolio',filters],queryFn:()=>apiFetch<CreativePortfolioPage>('/direccion-creativa/proyectos?'+params),enabled:enabled&&user?.rol==='lider_creativo',staleTime:15000});
}
export function useCreativeProjectDetail(projectId:string|null){
 const {data:user}=useMe();return useQuery({queryKey:['creative-leader',user?.id,'project-detail',projectId],queryFn:()=>apiFetch<CreativeProjectDetail>('/direccion-creativa/proyectos/'+projectId),enabled:!!projectId&&user?.rol==='lider_creativo',staleTime:15000});
}
export function useCreativePortfolioConcept(projectId:string,conceptId:string){
 const {data:user}=useMe();return useQuery({queryKey:['creative-leader',user?.id,'project-concept',projectId,conceptId],queryFn:()=>apiFetch<{concept:CreativePortfolioConcept;currentWorkItem:CreativeProjectSummary['currentWorkItem']}>('/direccion-creativa/proyectos/'+projectId+'/conceptos/'+conceptId),enabled:!!projectId&&!!conceptId&&user?.rol==='lider_creativo',staleTime:15000});
}
