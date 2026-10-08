import { apiFetch } from '../lib/api';
export type TipoDiseno = 'muestra_diagramacion' | 'diagramacion' | 'cubierta_extendida';
export interface VersionDiseno {
  id: string; numero: number; enlace: string; entregadoPorId: string; entregadoEn: string;
  feedback: string | null; feedbackEn: string | null; cantidadComentarios: number | null;
  enviadaAutorEn: string | null; feedbackAutorDueAt: string | null; aprobadaAutorEn: string | null;
  revisionCreativaId: string | null; aprobadaInternaEn: string | null; handoffEn: string | null;
  calidadWorkItemId: string | null; calidadFaseId: string | null;
}
export interface TrabajoDiseno {
  id: string; proyectoId: string; proyectoCodigo: string; autorNombre: string; servicioCodigo: string;
  tipo: TipoDiseno; fuenteUrl: string; disenadorId: string | null; disenadorNombre: string | null; diasReferencia: number | null; modalidad: string | null;
  dueAt: string | null; cerradoEn: string | null; estado: string; plazo: string | null;
  tituloDefinitivo: string; subtituloDefinitivo: string; briefEnlace: string; recursoImagenUrl: string; recursoConceptoPdfUrl: string;
  revisionCreativaResultado: string | null; versiones: VersionDiseno[];
}
export interface SolicitudDiseno {
  tipo: TipoDiseno; solicitudKey: string; fuenteUrl: string; preparacionConfirmada: boolean;
  capitulosMuestra?: number; correccionId?: string; aprobacionEdicionUrl?: string; dueAt?: string;
}
export const fetchDisenos = (proyectoId?: string, revisiones = false) => apiFetch<{ trabajos: TrabajoDiseno[] }>(proyectoId ? `/diseno/proyecto/${proyectoId}` : revisiones ? '/diseno/revisiones' : '/diseno/mios');
export const solicitarDiseno = (proyectoId: string, datos: SolicitudDiseno) => apiFetch(`/diseno/proyecto/${proyectoId}`, { method: 'POST', body: JSON.stringify(datos) });
export const asignarDiseno = (id: string, disenadorId: string, dueAt?: string) => apiFetch(`/diseno/${id}/asignar`, { method: 'PATCH', body: JSON.stringify({ disenadorId, dueAt }) });
export const entregarDiseno = (id: string, enlace: string, entregaKey: string) => apiFetch(`/diseno/${id}/versiones`, { method: 'POST', body: JSON.stringify({ enlace, entregaKey }) });
export const coordinarDiseno = (id: string, versionId: string, datos: { accion: 'enviar_autor' | 'feedback' | 'aprobar_autor' | 'handoff_calidad'; feedback?: string; cantidadComentarios?: number; feedbackAutorDueAt?: string }) => apiFetch(`/diseno/${id}/versiones/${versionId}`, { method: 'PATCH', body: JSON.stringify(datos) });
export const revisarCubierta = (id: string, versionId: string, aprobar: boolean, feedback?: string, interna = false) => apiFetch(`/diseno/${id}/versiones/${versionId}/${interna ? 'revision-interna' : 'revision-creativa'}`, { method: 'PATCH', body: JSON.stringify({ aprobar, feedback }) });
