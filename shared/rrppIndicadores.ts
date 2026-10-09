export interface DistribucionRrpp { nombre: string; cantidad: number; porcentaje: number }
export interface MesRrpp { clave: string; mes: string; planificaciones: number; lanzamientos: number; eventos: number; publicaciones: number; piezas: number; reuniones: number }
export interface FilaIndicadorRrpp {
  id: string; proyectoId: string; codigo: string; nombre: string; titulo: string | null;
  fecha: string; tipo: string; estado: string; lugar: string | null; responsable: string | null;
}
export interface IndicadoresRrpp {
  periodo: { from: string; to: string; anteriorFrom: string; anteriorTo: string; dias: number; zonaHoraria: string; hoy: string };
  summary: {
    proyectosConPlan: number; eventosRealizados: number; piezasPublicadas: number;
    satisfaccionExcelente: number | null; valoraciones: number; oportunidades: number;
    comparacionPlanes: number | null; comparacionEventos: number | null; comparacionPublicaciones: number | null;
  };
  monthly: MesRrpp[];
  previousMonthly: MesRrpp[];
  launches: { fases: DistribucionRrpp[]; fechas: DistribucionRrpp[]; ferias: DistribucionRrpp[]; realizados: number; cancelados: number };
  events: { total: number; tipos: DistribucionRrpp[]; estados: DistribucionRrpp[]; proximos: FilaIndicadorRrpp[] };
  publications: { total: number; tipos: DistribucionRrpp[]; estados: DistribucionRrpp[]; publicadasSinFecha: number };
  meetings: { realizadas: number; primeras: number; segundas: number; adicionales: number; pendientesSegunda: number; sinConfirmacion: number; promedio: number | null };
  satisfaction: DistribucionRrpp[];
  opportunities: { tipos: DistribucionRrpp[]; proyectos: number };
  upcoming: FilaIndicadorRrpp[];
  recent: FilaIndicadorRrpp[];
}
