import type { ProjectCommandCenter, ProcesoProyecto } from '../../../shared/projectCommandCenter';

// Mismo orden/dueño que PROCESOS_OPERATIVOS (shared/operacionEspecialista.ts)
// — coordinacion:'directa' ya es, sin inventar nada nuevo, la distinción
// real entre "secuencia principal" (el dueño ejecuta en orden) y "trabajo
// paralelo" (coordinado por otro actor: 'activacion'/'consulta'). No existe
// un tipo real "paquete final" ni "publicación y cierre" en el modelo de
// work_items — la línea principal real termina en Calidad; "paquete final"
// solo existe como condición dentro del gate real de Impresión.
export const LINEA_PRINCIPAL = ['preparacion_inicial', 'edicion', 'correccion', 'diseno', 'calidad'];
export const TERMINALES = ['Completo', 'Cancelado'];

// "En curso" = hay intervención real (work items), o RRPP ya activó la
// rama o tiene una solicitud en trámite — nunca solo "no es No aplica".
export function enCurso(p: ProcesoProyecto) {
  return p.trabajos.length > 0 || !!p.activacion?.activo || !!p.activacion?.solicitud;
}

export interface LineaPrincipal {
  pasos: ProcesoProyecto[];
  actualIndex: number; // -1 si no hay pasos aplicables, o si todos ya están terminados
  inconsistencia: { previo: ProcesoProyecto; posterior: ProcesoProyecto } | null;
  paralelos: ProcesoProyecto[];
}

// Una sola función, llamada desde Resumen y desde Operación, para
// Especialista y Jefatura por igual — nunca dos cálculos distintos de
// "dónde está el proyecto".
export function derivarLineaPrincipal(data: ProjectCommandCenter): LineaPrincipal {
  const pasos = LINEA_PRINCIPAL
    .map(tipo => data.procesos.find(p => p.tipo === tipo))
    .filter((p): p is ProcesoProyecto => !!p && p.estado !== 'No aplica');
  // El paso actual es el ÚLTIMO con intervención real registrada (la
  // frontera real de avance), no el primero incompleto — si un paso
  // anterior en la secuencia sigue incompleto, eso se reporta como
  // inconsistencia, no se usa para decidir "dónde estoy".
  const conActividad = pasos.map((p, i) => ({ p, i })).filter(({ p }) => !TERMINALES.includes(p.estado) && p.trabajos.length > 0);
  let actualIndex: number;
  if (conActividad.length) actualIndex = conActividad[conActividad.length - 1]!.i;
  else actualIndex = pasos.findIndex(p => !TERMINALES.includes(p.estado));
  let inconsistencia: LineaPrincipal['inconsistencia'] = null;
  if (actualIndex > 0) {
    const previo = pasos.slice(0, actualIndex).find(p => !TERMINALES.includes(p.estado));
    if (previo) inconsistencia = { previo, posterior: pasos[actualIndex]! };
  }
  const paralelos = data.procesos.filter(p => !LINEA_PRINCIPAL.includes(p.tipo));
  return { pasos, actualIndex, inconsistencia, paralelos };
}
