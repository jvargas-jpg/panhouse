import { useEffect,useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import type { ProjectWorkspaceFolder,ProjectWorkspaceSummary } from '../../../shared/projectWorkspace';
import { apiFetch } from '../lib/api';
import { invalidarOperacion } from './operacionQueries';
import { fechaSolicitud } from '../especialista/SolicitudesPage';
import { useProjectWorkspace } from './useProjectWorkspace';

function WorkspaceStructure({id,onClose}:{id:string;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const before=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();before?.focus();};},[]);
  const folders=useQuery({queryKey:['project-workspace-folders',id],queryFn:()=>apiFetch<{folders:ProjectWorkspaceFolder[]}>('/proyectos/'+id+'/workspace/folders')});
  function tree(parent:string){return <ul>{folders.data?.folders.filter(f=>f.parentFolderKey===parent).map(f=><li key={f.key}><span>{f.templatePath.split('/').at(-1)}</span>{f.driveUrl&&<a href={f.driveUrl} target="_blank" rel="noopener noreferrer" aria-label={'Abrir '+f.displayName}>Abrir ↗</a>}{tree(f.key)}</li>)}</ul>;}
  return <dialog ref={ref} className="cc-dialog cc-workspace-dialog" aria-label="Estructura documental" onCancel={onClose}><header><h2>Estructura documental</h2><button className="cc-close" onClick={onClose} aria-label="Cerrar estructura">×</button></header><div className="cc-dialog-body cc-workspace-tree">{folders.isPending?<p role="status">Consultando estructura…</p>:folders.isError?<p role="alert">No se pudo consultar la estructura. <button onClick={()=>folders.refetch()}>Reintentar</button></p>:tree('ROOT')}</div></dialog>;
}

export function ProjectWorkspaceCard({id,editable,initial,compact=false,structure=true}:{id:string;editable:boolean;initial?:ProjectWorkspaceSummary;compact?:boolean;structure?:boolean}){
  const cache=useQueryClient(),[expanded,setExpanded]=useState(false);
  const query=useProjectWorkspace(id,initial),data=query.data;
  const recovery=useMutation({mutationFn:()=>apiFetch<ProjectWorkspaceSummary>('/proyectos/'+id+'/workspace/retry',{method:'POST',body:'{}'}),
    onSuccess:result=>{cache.setQueryData(query.queryKey,result);invalidarOperacion(cache,id);},
    onError:()=>{void cache.invalidateQueries({queryKey:query.queryKey});invalidarOperacion(cache,id);}});
  const pending=recovery.isPending||['PENDING','PROVISIONING'].includes(data?.status??''),ready=data?.status==='READY'&&!data.contextChanged;
  const failed=data?.status==='ERROR'||data?.contextChanged;
  return <section className={'cc-workspace'+(compact?' cc-workspace-compact':'')} aria-label="Espacio documental">
    <div className="cc-workspace-head"><div><span className="cc-eyebrow">ESPACIO DOCUMENTAL</span><h3>Google Drive</h3></div>
      <span className={'cc-workspace-state '+(ready?'ready':failed?'error':'')}>{pending?'Preparando automáticamente…':ready?'✓ Configurado':failed?'Configuración incompleta':'No configurado'}</span></div>
    {query.isPending?<p role="status">Consultando espacio documental…</p>:pending?<div className="cc-workspace-progress" role="status"><span aria-hidden="true">◌</span><div><strong>Preparando automáticamente…</strong><p>PanHouse está creando la estructura documental del proyecto.</p></div></div>:ready&&!compact?<>
      <p className="cc-workspace-name">{data.rootName}</p><p className="cc-caption">Creada {fechaSolicitud(data.readyAt??data.createdAt,true)} · {data.folderCount} carpetas</p>
    </>:!ready&&<p className="cc-caption">{data?.message??(data?.legacy?'Este proyecto anterior aún no tiene espacio documental configurado.':'El espacio se preparará al confirmar la asignación del Especialista.')}</p>}
    {ready&&data.sharingStatus!=='GRANTED'&&<p className="cc-workspace-sharing">{data.sharingStatus==='REASSIGNMENT_REVIEW'?'Acceso de Drive pendiente de revisión por reasignación.':'Espacio creado. Acceso de Drive pendiente.'}</p>}
    {query.isError&&<p role="alert">No se pudo consultar el espacio documental. <button onClick={()=>query.refetch()}>Reintentar consulta</button></p>}
    {recovery.isError&&!pending&&<p className="cc-workspace-error" role="alert">{recovery.error.message}</p>}
    <div className="cc-workspace-actions">
      {editable&&!pending&&!ready&&!data?.contextChanged&&(data?.legacy||data?.canRetry)&&<button type="button" className="fv-button" disabled={query.isError} onClick={()=>recovery.mutate()}>{data?.legacy?'Configurar espacio':'Reintentar configuración'}</button>}
      {ready&&data.rootFolderUrl&&<a className="fv-button" href={data.rootFolderUrl} target="_blank" rel="noopener noreferrer">{compact?'Abrir carpeta':'Abrir Drive'} ↗</a>}
      {ready&&structure&&!compact&&<button type="button" className="fv-button" onClick={()=>setExpanded(true)}>Ver estructura</button>}
    </div>
    {expanded&&ready&&<WorkspaceStructure id={id} onClose={()=>setExpanded(false)}/>}
  </section>;
}
