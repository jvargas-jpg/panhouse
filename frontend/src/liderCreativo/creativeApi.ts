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
    onSuccess:()=>{for(const key of [['creative-leader'],['direcciones-creativas'],['direccion-creativa'],['diseno'],['proyecto'],['ficha-viva'],['mi-trabajo'],['notificaciones']])void cache.invalidateQueries({queryKey:key});}});
}

export function useCreativeWork(filters:CreativeWorkFilters,enabled=true){
 const {data:user}=useMe(),params=new URLSearchParams(Object.entries(filters).map(([k,v])=>[k,String(v)]));
 return useQuery({queryKey:['creative-leader',user?.id,'work',filters],queryFn:()=>apiFetch<CreativeWorkPage>('/direccion-creativa/mi-trabajo?'+params),enabled:enabled&&user?.rol==='lider_creativo',staleTime:15000});
}
