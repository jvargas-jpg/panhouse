export interface ProyectoTrabajo { id:string;codigo:string;titulo:string;autores:string;portadaUrl:string|null;servicio:string;fechaObjetivo:string|null }
export type TipoSolicitud = 'editor' | 'creativa' | 'contrato' | 'calidad' | 'digital' | 'lanzamiento' | 'impresion';
export type EstadoSolicitud = 'pendiente' | 'en_revision' | 'requiere_informacion' | 'resuelta' | 'rechazada' | 'cancelada';
export interface SolicitudOperativa {
  id: string; tipo: TipoSolicitud; titulo: string; proyecto: ProyectoTrabajo; proceso: string; workItemId: string | null; businessKey: string;
  destino: { rol: string; nombre: string }; estado: EstadoSolicitud; requestedAt: string;
  resolvedAt: string | null; outcome: string | null; requiresUserAction: boolean;
}
export interface DetalleSolicitud extends SolicitudOperativa {
  version?: number;
  contexto: { label: string; value: string }[];
  historial: { id: string; texto: string; actor: string; fecha: string }[];
  enlaces: { label: string; url: string }[];
  pregunta: { id: string; texto: string; actor: string; fecha: string; respuesta: string | null; respondidaEn: string | null } | null;
}
export interface FiltrosSolicitudes { tab: 'abiertas' | 'informacion' | 'resueltas' | 'todas'; tipo?: TipoSolicitud; destino?: string; estado?: EstadoSolicitud; proyecto?: string; desde?: string; hasta?: string; search: string; page: number; pageSize: number }
export interface SolicitudesEspecialista {
  actualizadoEn: string; solicitudes: SolicitudOperativa[]; total: number; page: number; pages: number; pageSize: number;
  resumen: { abiertas: number; revision: number; informacion: number; resueltas: number };
  catalogos: { tipos: { tipo: TipoSolicitud; nombre: string }[]; destinos: { rol: string; nombre: string }[]; proyectos: { id: string; titulo: string }[] };
}
