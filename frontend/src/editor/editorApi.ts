import { apiFetch } from '../lib/api';
import type { EditorProjectDetail, EditorProjectList } from '../../../shared/editorProjects';
import type { EditorDashboard, EditorRequestDetail, EditorRequestList, EditorRequestType, EditorWorkDetail, EditorWorkRow } from '../../../shared/editorOwn';

export const editorKey = ['editor'];
export const fetchEditorDashboard = () => apiFetch<EditorDashboard>('/editores/mi-inicio');

export const fetchMiTrabajo = (params: URLSearchParams) =>
  apiFetch<{ items: EditorWorkRow[]; total: number; pages: number; page: number; counts: Record<string, number>; summary?:{inProgress:number;dueSoon:number;blocked:number;feedback:number}; options?:{states:string[];services:{id:string;name:string}[];types:{id:string;name:string}[];projects:{id:string;name:string}[]} }>('/editores/mi-trabajo?' + params);
export const fetchMiTrabajoDetalle = (id: string) => apiFetch<EditorWorkDetail>('/editores/mi-trabajo/' + id);
export const iniciarTrabajo = (id: string) => apiFetch<{ ok: true }>('/editores/mi-trabajo/' + id + '/iniciar', { method: 'POST', body: '{}' });
export const registrarEntrega = (id: string, driveUrl: string, observaciones?: string) =>
  apiFetch<{ ok: true; deliveryId: string }>('/editores/mi-trabajo/' + id + '/entrega', { method: 'PATCH', body: JSON.stringify({ driveUrl, observaciones: observaciones || undefined }) });
export const reportarBloqueo = (id: string, reason: string) =>
  apiFetch<{ ok: true; blockerId: string }>('/editores/mi-trabajo/' + id + '/bloqueo', { method: 'POST', body: JSON.stringify({ reason }) });
export const resolverBloqueo = (id: string, resolution?: string) =>
  apiFetch<{ ok: true }>('/editores/mi-trabajo/' + id + '/bloqueo/resolver', { method: 'POST', body: JSON.stringify({ resolution: resolution || undefined }) });

export const fetchMisProyectos = (params: URLSearchParams) => apiFetch<EditorProjectList>('/editores/mis-proyectos?' + params);
export const fetchMiProyectoDetalle = (projectId: string) => apiFetch<EditorProjectDetail>('/editores/mis-proyectos/' + projectId);

export const fetchMisSolicitudes = (params: URLSearchParams) => apiFetch<EditorRequestList>('/editores/mis-solicitudes?' + params);
export const fetchMiSolicitudDetalle = (id: string) => apiFetch<EditorRequestDetail>('/editores/mis-solicitudes/' + id);
export const crearSolicitud = (workItemId: string, type: EditorRequestType, motivo: string) =>
  apiFetch<{ ok: true; id: string }>('/editores/mis-solicitudes', { method: 'POST', body: JSON.stringify({ workItemId, type, motivo }) });
export const cancelarSolicitud = (id: string, expectedVersion: number) =>
  apiFetch<{ ok: true }>('/editores/mis-solicitudes/' + id + '/cancelar', { method: 'POST', body: JSON.stringify({ expectedVersion }) });

export const registrarAvance = (id:string,note:string)=>apiFetch('/editores/mi-trabajo/'+id+'/avance',{method:'POST',body:JSON.stringify({note})});
export const fetchArchivosEntrega=(id:string,folderKey:string,pageToken?:string)=>apiFetch<{items:{id:string;name:string;url:string}[];nextPageToken:string|null}>('/editores/mi-trabajo/'+id+'/archivos?'+new URLSearchParams({folderKey,...(pageToken?{pageToken}:{})}));
export const responderSolicitud=(id:string,expectedVersion:number,text:string)=>apiFetch('/editores/mis-solicitudes/'+id+'/responder',{method:'POST',body:JSON.stringify({expectedVersion,text})});

export async function cargarArchivoEditorial(id:string,folderKey:string,file:File){
 if(file.size>8*1024*1024||!file.size)throw new Error('Selecciona un documento de hasta 8 MB.');
 const contentBase64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
 return apiFetch<{id:string;name:string;url:string}>('/editores/mi-trabajo/'+id+'/archivos',{method:'POST',body:JSON.stringify({folderKey,name:file.name,mimeType:file.type||'application/octet-stream',contentBase64})});
}
