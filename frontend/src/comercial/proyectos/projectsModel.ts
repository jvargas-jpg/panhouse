import type { EstadoProyecto, ProyectoPendienteSeccion1, ProyectoResumen } from '../../types/api';

export type ProjectsFilter = 'todos' | 'pendientes' | 'listos';
export type ProjectsOrder = 'original' | 'autor' | 'codigo';

export interface CommercialProject {
  id: string;
  codigo: string | undefined;
  titulo: string | null;
  autores: { id: string; nombre: string }[];
  autorPrincipal: string;
  servicio: ProyectoResumen['servicio'];
  estado?: EstadoProyecto;
  pendiente: boolean;
  faltantesComercial: ProyectoResumen['faltantesComercial'];
  datosEdicion?: ProyectoPendienteSeccion1;
}

// El DTO activo incluye la preparación comercial evaluada en backend.
export function buildProjects(activos: ProyectoResumen[], filtro: ProjectsFilter): CommercialProject[] {
  return activos.filter((p) => filtro === 'todos' || (filtro === 'listos' ? p.listoParaRrpp : !p.listoParaRrpp)).map((p) => ({
    ...p, autorPrincipal: p.autor.nombre, pendiente: !p.listoParaRrpp, datosEdicion: p,
  }));
}

export function projectName(p: CommercialProject): string {
  return p.titulo?.trim() || p.autores.map((a) => a.nombre).join(', ') || 'Sin autor';
}

export function filterProjects(proyectos: CommercialProject[], busqueda: string, orden: ProjectsOrder) {
  const q = busqueda.trim().toLocaleLowerCase('es');
  const lista = proyectos.filter((p) => !q || [p.id, p.codigo ?? '', p.titulo ?? '', p.servicio.codigo,
    p.servicio.nombre, ...p.autores.map((a) => a.nombre)].some((v) => v.toLocaleLowerCase('es').includes(q)));
  if (orden === 'autor') lista.sort((a, b) => a.autorPrincipal.localeCompare(b.autorPrincipal, 'es', { sensitivity: 'base' }));
  if (orden === 'codigo') lista.sort((a, b) => (a.codigo ?? '').localeCompare(b.codigo ?? '', 'es'));
  return lista;
}
