import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import type { AreaFicha, ExpedienteFicha, HistorialFicha, ResumenFichaViva } from '../../../../shared/fichaViva';

const base=(id:string)=>'/fichas-trazabilidad/'+id;
export function useFichaViva(id:string,identity:string|undefined){
  return useQuery({queryKey:['ficha-viva',id,identity,'resumen'],queryFn:()=>apiFetch<ResumenFichaViva>(base(id)+'/resumen'),enabled:!!identity,staleTime:15000,refetchOnMount:'always'});
}
export function useExpediente(id:string,identity:string|undefined,enabled:boolean){
  return useQuery({queryKey:['ficha-viva',id,identity,'expediente'],queryFn:()=>apiFetch<ExpedienteFicha>(base(id)+'/expediente'),enabled:!!identity&&enabled,staleTime:15000,refetchOnMount:'always'});
}
export function useActividadFicha(id:string,identity:string|undefined,enabled:boolean){
  return useInfiniteQuery({queryKey:['ficha-viva',id,identity,'actividad'],initialPageParam:undefined as string|undefined,queryFn:({pageParam})=>apiFetch<HistorialFicha>(base(id)+'/actividad'+(pageParam?'?cursor='+encodeURIComponent(pageParam):'')),getNextPageParam:last=>last.nextCursor??undefined,enabled:!!identity&&enabled,staleTime:15000});
}
export function useGuardarDocumental(id:string){
  const cache=useQueryClient();
  return useMutation({mutationFn:({area,key,value}:{area:AreaFicha;key:string;value:string|number|boolean|null})=>apiFetch<{ok:boolean}>(base(id)+'/documental/'+area,{method:'PATCH',body:JSON.stringify({datos:{[key]:value}})}),onSuccess:()=>cache.invalidateQueries({queryKey:['ficha-viva',id]})});
}
