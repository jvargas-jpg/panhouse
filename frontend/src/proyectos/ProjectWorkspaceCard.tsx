import { useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import type { ProjectWorkspaceFolder,ProjectWorkspaceSummary } from '../../../shared/projectWorkspace';
import { apiFetch } from '../lib/api';
import { invalidarOperacion } from './operacionQueries';
import { fechaSolicitud } from '../especialista/SolicitudesPage';

export function ProjectWorkspaceCard({id,editable,initial}:{id:string;editable:boolean;initial?:ProjectWorkspaceSummary}){
  const cache=useQueryClient(),[expanded,setExpanded]=useState(false);
  const query=useQuery({queryKey:['project-workspace',id],queryFn:()=>apiFetch<ProjectWorkspaceSummary>('/proyectos/'+id+'/workspace'),initialData:initial,
    refetchInterval:q=>q.state.data?.status==='PROVISIONING'?1500:false});
  const folders=useQuery({queryKey:['project-workspace-folders',id],queryFn:()=>apiFetch<{folders:ProjectWorkspaceFolder[]}>('/proyectos/'+id+'/workspace/folders'),enabled:expanded});
  const data=query.data;
  const create=useMutation({mutationFn:()=>apiFetch<ProjectWorkspaceSummary>('/proyectos/'+id+'/workspace'+(data?.status==='ERROR'?'/retry':''),{method:'POST',body:'{}'}),
    onSuccess:async result=>{cache.setQueryData(['project-workspace',id],result);await cache.invalidateQueries({queryKey:['project-workspace-folders',id]});invalidarOperacion(cache,id);},
    onError:()=>{void cache.invalidateQueries({queryKey:['project-workspace',id]});invalidarOperacion(cache,id);}});
  const pending=create.isPending||data?.status==='PROVISIONING',ready=data?.status==='READY'&&!data.contextChanged;
  return <section className="cc-workspace" aria-label="Espacio documental">
    <div className="cc-workspace-head"><div><span className="cc-eyebrow">ESPACIO DOCUMENTAL</span><h3>Google Drive</h3></div>
      <span className={'cc-workspace-state '+(ready?'ready':data?.status==='ERROR'||data?.contextChanged?'error':'')}>{pending?'En configuración':ready?'✓ Configurado':data?.contextChanged?'Requiere revisión':data?.status==='ERROR'?'Configuración incompleta':'No configurado'}</span></div>
    {query.isPending?<p role="status">Consultando espacio documental…</p>:pending?<div className="cc-workspace-progress" role="status"><span aria-hidden="true">◌</span><div><strong>Configurando espacio documental…</strong><p>Preparando carpetas del proyecto.{data?.folderCount?` ${data.folderCount} de ${data.expectedFolderCount} carpetas verificadas.`:''}</p></div></div>:ready?<>
      <p className="cc-workspace-name">{data.rootName}</p><p className="cc-caption">Creada {fechaSolicitud(data.readyAt??data.createdAt,true)} · {data.folderCount} carpetas</p>
      <p className="cc-workspace-sharing">{data.sharingStatus==='GRANTED'?'Acceso del Especialista concedido':data.sharingStatus==='REASSIGNMENT_REVIEW'?'Acceso Drive: revisión pendiente por reasignación':data.sharingStatus==='PENDING_EMAIL'?'Acceso Drive: pendiente de correo corporativo':'Acceso Drive: pendiente de validación'}</p>
    </>:<p className="cc-caption">{data?.message??'PanHouse creará la estructura documental correspondiente al servicio de este proyecto.'}</p>}
    {query.isError&&<p role="alert">{query.error.message}</p>}
    {create.isError&&!pending&&<p className="cc-workspace-error" role="alert">{create.error.message}</p>}
    <div className="cc-workspace-actions">
      {editable&&!ready&&!data?.contextChanged&&<button type="button" className="fv-button fv-primary" disabled={pending||query.isPending||query.isError} onClick={()=>create.mutate()}>{pending?'Preparando carpetas…':data?.status==='ERROR'?'Reintentar':'Crear espacio de trabajo'}</button>}
      {ready&&data.rootFolderUrl&&<a className="fv-button fv-primary" href={data.rootFolderUrl} target="_blank" rel="noopener noreferrer">Abrir Drive ↗</a>}
      {ready&&<button type="button" className="fv-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Ocultar estructura':'Ver estructura'}</button>}
    </div>
    {expanded&&ready&&<div className="cc-workspace-folders">{folders.isPending?<p role="status">Consultando carpetas…</p>:folders.isError?<p role="alert">No se pudo consultar la estructura. <button type="button" onClick={()=>folders.refetch()}>Reintentar</button></p>:<ul>{folders.data.folders.filter(f=>f.key!=='ROOT').map(f=><li key={f.key} style={{paddingLeft:Math.min(3,f.templatePath.split('/').length-1)*12}}>{f.driveUrl?<a href={f.driveUrl} target="_blank" rel="noopener noreferrer">{f.displayName} ↗</a>:f.displayName}</li>)}</ul>}</div>}
  </section>;
}
