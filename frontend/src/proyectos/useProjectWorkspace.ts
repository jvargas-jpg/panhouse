import { useEffect,useRef } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import type { ProjectWorkspaceSummary } from '../../../shared/projectWorkspace';
import { apiFetch } from '../lib/api';
import { useMe } from '../auth/useAuth';
import { invalidarOperacion } from './operacionQueries';

export function useProjectWorkspace(id:string,initial?:ProjectWorkspaceSummary,enabled=true){
  const cache=useQueryClient(),{data:user}=useMe();
  const queryKey=['project-workspace',id,user?.id];
  const query=useQuery({queryKey,queryFn:()=>apiFetch<ProjectWorkspaceSummary>('/proyectos/'+id+'/workspace'),
    initialData:initial,enabled:enabled&&!!user,staleTime:1000,
    refetchInterval:q=>['PENDING','PROVISIONING'].includes(q.state.data?.status??'')?1500:false});
  const previous=useRef<string>();
  const signature=query.data?`${query.data.status}:${query.data.lastErrorCode}:${query.data.folderCount}`:undefined;
  useEffect(()=>{
    if(previous.current&&signature&&signature!==previous.current){
      invalidarOperacion(cache,id);
      void cache.invalidateQueries({queryKey:['project-workspace-folders',id]});
    }
    previous.current=signature;
  },[cache,id,signature]);
  return {...query,queryKey};
}
