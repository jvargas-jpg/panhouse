import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useMe} from '../auth/useAuth';
import {apiFetch} from '../lib/api';
export const adminKey=['admin'] as const;
export function useAdminQuery<T>(path:string|null,keep=false){const {data:user}=useMe();return useQuery<T>({queryKey:[...adminKey,user?.id,path],queryFn:()=>apiFetch<T>('/admin'+path),enabled:user?.rol==='admin'&&!!path,staleTime:15000,retry:1,placeholderData:keep?(previous,query)=>query?.queryKey[1]===user?.id&&String(query?.queryKey[2]).split('?')[0]===path?.split('?')[0]?previous:undefined:undefined});}
export const adminPost=<T=Record<string,unknown>>(path:string,payload:object)=>apiFetch<T>('/admin'+path,{method:'POST',body:JSON.stringify(payload)});
export function useAdminRefresh(){const cache=useQueryClient();return ()=>cache.invalidateQueries({queryKey:adminKey});}
