import { apiFetch } from '../lib/api.js';
export type EstadoIngreso = 'nuevo' | 'diagnostico' | 'listo' | 'enviado';
export type DatosIngreso = Record<string, string | boolean | string[] | null>;
export interface PreparacionIngreso {
  listoParaJefatura: boolean;
  progreso: number;
  faltantes: { campo: string; etiqueta: string; completo: boolean }[];
  checklist: { campo: string; etiqueta: string; completo: boolean }[];
}
export interface ResumenIngreso {
  id: string;
  codigo: string;
  nombre: string;
  titulo: string | null;
  posibleTitulo: string | null;
  servicio: { codigo: string; nombre: string };
  estado: EstadoIngreso;
  preparacion: PreparacionIngreso;
  actualizadoAt: string | null;
  actualizadoPor: string;
  enviadoAt: string | null;
  guardadoAt: string | null;
}
export interface DetalleIngreso extends ResumenIngreso {
  editable: boolean;
  datos: DatosIngreso;
  fechaProyectada: string | null;
  contexto: {
    autorPrincipal: string;
    coautores: string[];
    fechaIngreso: string | null;
    ejecucion: string;
    tiempoExpresMeses: number | null;
    alianza: boolean;
    presupuesto: string | null;
    capitulos: string | null;
    paginas: string | null;
    condiciones: string[] | null;
    criterioExtra: string | null;
    observaciones: string | null;
  };
}
export interface CatalogosIngreso {
  colecciones: string[];
  estadosReunion: string[];
  propietarios: string[];
  publicosSexo: string[];
  subtiposCrudo: string[];
}
export const fetchIngresos = () =>
  apiFetch<{ ingresos: ResumenIngreso[]; catalogos: CatalogosIngreso }>(
    '/rrpp/ingresos',
  );
export const fetchIngreso = (id: string) =>
  apiFetch<DetalleIngreso>(`/rrpp/ingresos/${id}`);
export const guardarIngreso = (id: string, datos: DatosIngreso) =>
  apiFetch<DetalleIngreso>(`/rrpp/ingresos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
export const enviarIngreso = (id: string) =>
  apiFetch(`/proyectos/${id}/notificar-jefatura`, { method: 'POST' });
export const ESTADOS_INGRESO = {
  nuevo: {
    nombre: 'Nuevo ingreso',
    color: 'bg-amber-50 text-amber-700',
    barra: 'bg-amber-400',
    accion: 'Iniciar diagnóstico',
  },
  diagnostico: {
    nombre: 'En diagnóstico',
    color: 'bg-blue-100 text-blue-700',
    barra: 'bg-blue-500',
    accion: 'Continuar ingreso',
  },
  listo: {
    nombre: 'Listo para Jefatura',
    color: 'bg-green-100 text-green-700',
    barra: 'bg-green-500',
    accion: 'Revisar',
  },
  enviado: {
    nombre: 'Enviado a Jefatura',
    color: 'bg-slate-100 text-slate-600',
    barra: 'bg-slate-400',
    accion: 'Consultar',
  },
};
