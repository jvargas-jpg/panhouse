import { apiFetch } from "../lib/api";
export const LANZAMIENTOS_API = "/rrpp/lanzamientos";
export type CampoLanzamiento = string | boolean | string[] | null;
export interface PlanLista {
  id: string;
  codigo: string;
  nombre: string;
  autorId: string;
  servicio: { codigo: string; nombre: string };
  estado: string;
  fase: string | null;
  feria: string | null;
  responsable: string | null;
  responsableId: string | null;
  proximaAccion: string;
  proximaFecha: string | null;
}
export interface Paginado {
  total: number;
  pagina: number;
  paginas: number;
}
export interface HistorialLanzamiento extends Paginado {
  eventos: {
    id: string;
    fecha: string;
    titulo: string;
    codigo: string;
    proyectoId: string;
    actor: string | null;
  }[];
}
export interface EventoRrpp {
  id: string;
  proyectoId: string;
  clientKey: string;
  tipo: string;
  estado: string;
  fase: string | null;
  fecha: string;
  hora: string | null;
  lugar: string | null;
  responsableId: string | null;
  representanteId: string | null;
  rutaActividad: string | null;
  notasRrss: string | null;
  programas: string | null;
  codigo?: string;
  nombre?: string;
  responsable?: string | null;
}
export interface PublicacionRrpp {
  id: string;
  proyectoId: string;
  clientKey: string;
  tipo: string;
  estado: string;
  estadoPieza: string | null;
  detalles: string | null;
  notas: string | null;
  responsableId: string | null;
  codigo?: string;
  nombre?: string;
  responsable?: string | null;
  fechaLanzamiento?: string | null;
}
export interface ReunionRrpp {
  id: string;
  fecha: string | null;
  puntosTratados: string | null;
  acuerdos: string | null;
  realizada: boolean | null;
  responsableId: string | null;
  responsable: string | null;
  clientKey: string | null;
}
export interface PlanDetalle extends PlanLista {
  titulo: string | null;
  portadaUrl: string | null;
  ficha: Record<string, CampoLanzamiento>;
  reuniones: ReunionRrpp[];
  eventos: EventoRrpp[];
  publicaciones: PublicacionRrpp[];
  totalEventos: number;
  totalPublicaciones: number;
  reunionesPaginacion: Paginado;
  historial: HistorialLanzamiento;
  asignaciones: {
    id: string;
    nombre: string;
    desde: string;
    hasta: string | null;
  }[];
  editable: boolean;
  participantes: { id: string; nombre: string }[];
}
export interface CatalogosLanzamiento {
  fases: string[];
  satisfaccion: string[];
  ferias: string[];
  feriasConfirmadas: string[];
  futuroAutor: string[];
  ventaCruzada: string[];
  responsables: { id: string; nombre: string }[];
  tiposEvento: string[];
  estadosEvento: string[];
  fasesEvento: string[];
  representantes: { id: string; nombre: string }[];
  tiposPublicacion: string[];
  estadosPublicacion: string[];
  estadosPiezaFuturo: string[];
  estadosPiezaNovedades: string[];
}
export const fetchPlanes = (f: string) =>
  apiFetch<Paginado & { proyectos: PlanLista[] }>(
    `${LANZAMIENTOS_API}${f ? `?${f}` : ""}`,
  );
export const fetchPlan = (id: string, reunionesPagina = 1) =>
  apiFetch<PlanDetalle>(
    `${LANZAMIENTOS_API}/planes/${id}?reunionesPagina=${reunionesPagina}`,
  );
export const fetchCatalogosLanzamiento = () =>
  apiFetch<CatalogosLanzamiento>(`${LANZAMIENTOS_API}/catalogos`);
export const fetchAgenda = (f: string) =>
  apiFetch<{ eventos: EventoRrpp[]; limiteAlcanzado: boolean }>(
    `${LANZAMIENTOS_API}/agenda?${f}`,
  );
export const fetchPublicaciones = (f: string) =>
  apiFetch<Paginado & { publicaciones: PublicacionRrpp[] }>(
    `${LANZAMIENTOS_API}/publicaciones?${f}`,
  );
export const fetchHistorialLanzamiento = (f: string) =>
  apiFetch<HistorialLanzamiento>(`${LANZAMIENTOS_API}/historial?${f}`);
