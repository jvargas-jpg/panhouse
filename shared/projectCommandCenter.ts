import type { ResumenFichaViva, CampoFicha } from './fichaViva.js';
import type { ProyectoJefatura } from './jefatura.js';

export interface TrabajoProyecto {
  id: string; tipo: string; nombre: string; estado: string;
  instancia: string; responsable: string | null; vence: string | null;
  vencido: boolean; gate: string | null; decisionId: string | null;
  inicio: string | null; cierre: string | null;
}
export interface ProcesoProyecto {
  tipo: string; nombre: string; estado: string; detalle: string;
  trabajos: TrabajoProyecto[];
}
export interface ProjectCommandCenter {
  atencion: { id: string; titulo: string; detalle: string; proceso?: string; href?: string; editarContexto?: boolean }[];
  ficha: ResumenFichaViva;
  salud: Pick<ProyectoJefatura, 'especialista' | 'express' | 'riesgo' | 'fechaObjetivo'> | null;
  procesos: ProcesoProyecto[];
  administracion: CampoFicha[];
  datosEditoriales: { titulo: string | null; subtitulo: string | null; manuscritoUrl: string | null };
  capabilities: { registrarAvance: boolean; supervisar: boolean };
}
