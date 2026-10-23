import { apiFetch } from '../lib/api';
import type { CargaEditor, ProyectoPendienteSeccion1 } from '../types/api';
import type { EditorialActivity, EditorialDashboard, EditorialIntervention, EditorialAssignmentList, EditorialLoadSummary, EditorialRecommendation } from '../../../shared/editorialChief';
export const editorialKey = ['editorial-chief'];
export const fetchEditorialDashboard = () => apiFetch<EditorialDashboard>('/editores/inicio');
export const fetchEditorialActivity = () => apiFetch<{items:EditorialActivity[]}>('/editores/actividad');
export const fetchEditorialIntervention = (id:string) => apiFetch<EditorialIntervention>('/editores/intervenciones/'+id);
export const fetchEditorialList = (params:URLSearchParams) => apiFetch<{items:EditorialIntervention[];total:number;pages:number;page:number}>('/editores/intervenciones?'+params);
export const decideEditor = (id:string,editorId:string,reason?:string,expectedEditorId?:string|null,expectedAssignmentId?:string|null) => apiFetch('/editores/asignaciones/'+id,{method:'PATCH',body:JSON.stringify({editorId,reason,expectedEditorId,expectedAssignmentId})});
export const fetchEditorialAssignments = (params: URLSearchParams) => apiFetch<EditorialAssignmentList>('/editores/asignaciones?'+params);
export const fetchEditorialTeam = () => apiFetch<EditorialLoadSummary>('/editores/equipo');
export const fetchEditorialCandidates = (id: string) => apiFetch<EditorialRecommendation>('/editores/intervenciones/'+id+'/candidatos');

// Punto de partida del flujo de jefe_edicion: mismo patrón que
// "Autores sin proyecto" de jefe_area (server/helpers/proyectos.ts:listarProyectosSinEditor).
export function fetchProyectosSinEditor() {
  return apiFetch<{ proyectos: ProyectoPendienteSeccion1[] }>('/proyectos/sin-editor');
}

export function fetchCargaEditores() {
  return apiFetch<{ editores: CargaEditor[] }>('/editores/carga');
}

// Mismo endpoint que ya usa jefe_area para especialista
// (PATCH /proyectos/:id/especialista), acá con editor.
export function asignarEditor(proyectoId: string, editorId: string) {
  return apiFetch<{ ok: true }>(`/proyectos/${proyectoId}/editor`, {
    method: 'PATCH',
    body: JSON.stringify({ editorId }),
  });
}
