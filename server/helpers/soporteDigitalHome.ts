import { pool } from '../db/client.js';
import { diaCaracas } from './atencionEspecialista.js';
import { digitalWorkUrl, type DigitalCounts, type DigitalDeadlineState, type DigitalPriorityTask, type DigitalStage, type DigitalSupportDashboard } from '../../shared/soporteDigitalHome.js';

// La asignación individual digital_id se retiró por decisión del negocio.
// Scope: únicamente proyectos con activación/intervención digital explícita;
// bandeja compartida por rol, nunca todos los proyectos con ficha vacía.
export const scope = `SELECT DISTINCT p.id FROM proyectos p JOIN work_items w ON w.proyecto_id=p.id
  WHERE w.tipo='soporte_digital' AND w.estado<>'cancelado' AND p.estado<>'retirado'`;
export type DigitalWorkItemRow = {
  id: string; proyecto_id: string; codigo: string; title: string; authors: string; cover: string | null;
  business_key: string; estado: string; project_state: string; gate_bloqueante: string | null;
  deadline: string | null; created_at: Date; task_name: string | null;
  activation: string | null; form_sent: string | null; digital_status: string | null;
  package_available: boolean; tested: boolean; loaded: boolean;
};
type Row = DigitalWorkItemRow;
// Mismo SELECT que usa Inicio y Mi trabajo — una sola definición de qué
// es una fila de trabajo digital, para que ambas pantallas nunca puedan
// divergir en qué cuenta como preparación/pruebas/carga/completado.
export const DIGITAL_WORK_ROWS_SQL = `WITH scope AS (${scope}) SELECT w.id,w.proyecto_id,w.business_key,w.estado,w.gate_bloqueante,
  w.fecha_fin_pautada::text deadline,w.created_at,ps.nombre task_name,p.codigo,p.estado project_state,
  coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
  coalesce(au.names,a.nombre) authors,CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover,
  f.soporte_digital_fecha_activacion::text activation,f.soporte_digital_fecha_envio_formulario::text form_sent,f.digital_estatus digital_status,
  coalesce(d.datos->'paqueteFinalCargado'='true'::jsonb,false) package_available,
  coalesce(nullif(g.datos->>'pruebaArchivos',''),'')<>'' tested,
  (coalesce(nullif(g.datos->>'cargaKdp',''),'')<>'' OR coalesce(nullif(g.datos->>'cargaKindle',''),'')<>'') loaded
  FROM scope s JOIN proyectos p ON p.id=s.id JOIN work_items w ON w.proyecto_id=p.id AND w.tipo='soporte_digital' AND w.estado<>'cancelado'
  JOIN autores a ON a.id=p.autor_id LEFT JOIN pasos ps ON ps.id=w.paso_id
  LEFT JOIN (SELECT x.proyecto_id,string_agg(a.nombre,', ' ORDER BY a.nombre) names FROM proyectos_autores x JOIN autores a ON a.id=x.autor_id GROUP BY x.proyecto_id) au ON au.proyecto_id=p.id
  LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id
  LEFT JOIN ficha_documental_datos d ON d.proyecto_id=p.id AND d.seccion='diseno'
  LEFT JOIN ficha_documental_datos g ON g.proyecto_id=p.id AND g.seccion='digital'`;

export function digitalDeadline(date: string | null, today: string): DigitalDeadlineState {
  if (!date) return null;
  if (date < today) return 'overdue';
  if (date === today) return 'today';
  const days = (Date.parse(date + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000;
  return days <= 2 ? 'soon' : 'scheduled';
}
export function stage(r: Row): DigitalStage {
  // Completado es un control interno existente: NO equivale a publicado.
  if (r.digital_status?.trim().toLowerCase() === 'completado') return 'completed';
  if (r.loaded) return 'loaded';
  if (r.package_available && r.activation) return 'testing';
  return 'preparation';
}
// Única derivación real de estado de una fila de trabajo digital —
// Inicio (toTask) y Mi trabajo (toWorkRow en soporteDigitalWork.ts)
// construyen su DTO final sobre este mismo resultado, nunca recalculan
// paused/blocked/waitingPackage/actionable por su cuenta (la causa de
// los dos bugs reales encontrados en la auditoría de Inicio: una pantalla
// mostraba una etapa y la otra una cuenta distinta para la misma fila).
export interface DerivedWork {
  stage: DigitalStage; taskLabel: string; deadline: string | null; deadlineState: DigitalDeadlineState;
  status: string; blocker: string | null; actionable: boolean; packageAvailable: boolean;
}
export function deriveWork(r: Row, today: string): DerivedWork {
  // Señal real de que la cuenta Amazon ya está activada (fecha en la ficha),
  // no el tipo de work item: el mismo ítem de activación sigue siendo la
  // única fila real del proyecto después de activarse, y su etapa/tarea
  // debe seguir avanzando con el proceso en vez de quedar fija en
  // "preparación" para siempre (ver stage()/summary, misma fuente de verdad).
  const accountActivated = !!r.activation;
  const paused = r.project_state === 'pausado';
  const completedProject = r.project_state === 'culminado';
  const blocked = r.estado === 'bloqueado' || !!r.gate_bloqueante;
  // Las tareas posteriores a activación esperan el hito de entrega real,
  // no la existencia de una carpeta ni un archivo suelto de Drive.
  const waitingPackage = accountActivated && !r.package_available;
  const internalDone = stage(r) === 'completed';
  const actionable = !paused && !completedProject && !blocked && !waitingPackage && !internalDone;
  const blocker = paused ? 'Proyecto en pausa' : completedProject ? 'Proyecto culminado' : blocked
    ? (/solvencia|financ|cobranza/i.test(r.gate_bloqueante ?? '') ? 'Bloqueado por solvencia' : 'Bloqueado por una condición del proceso')
    : waitingPackage ? 'Esperando la entrega del paquete final' : internalDone ? 'Control digital completado; revisar el cierre de esta tarea' : null;
  const fallback = !accountActivated ? (r.form_sent ? 'Registrar la activación Amazon' : 'Enviar el formulario de activación Amazon')
    : r.loaded ? 'Consultar el seguimiento digital' : r.tested ? 'Continuar la preparación de carga KDP' : 'Revisar los archivos finales para KDP';
  return {
    stage: stage(r), taskLabel: r.task_name ?? fallback,
    deadline: r.deadline, deadlineState: actionable ? digitalDeadline(r.deadline, today) : null,
    status: paused ? 'Proyecto en pausa' : blocker ? 'En espera' : r.estado === 'en_progreso' ? 'En curso' : 'Pendiente',
    blocker, actionable, packageAvailable: r.package_available,
  };
}
function toTask(r: Row, today: string): DigitalPriorityTask {
  const d = deriveWork(r, today);
  return {
    workItemId: r.id, projectId: r.proyecto_id, projectTitle: r.title, projectCode: r.codigo, authors: r.authors, coverUrl: r.cover,
    taskType: r.business_key, href: digitalWorkUrl(r.proyecto_id, r.id), ...d,
  };
}
interface Rankable { workItemId: string; projectTitle: string; deadline: string | null; deadlineState: DigitalDeadlineState; actionable: boolean }
export function compareDigitalTasks<T extends Rankable>(a: T, b: T) {
  const rank = (r: Rankable) => !r.actionable ? 4 : r.deadlineState === 'overdue' ? 0 : r.deadlineState === 'today' ? 1 : r.deadlineState === 'soon' ? 2 : 3;
  return rank(a) - rank(b) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.projectTitle.localeCompare(b.projectTitle, 'es') || a.workItemId.localeCompare(b.workItemId);
}

export async function getDigitalSupportDashboard(now = new Date()): Promise<DigitalSupportDashboard> {
  // Dos queries acotadas por módulo, sin N+1, sin Drive ni llamadas a Amazon.
  // Nunca se selecciona cuenta Amazon, observaciones libres ni datos financieros.
  const [workResult, activityResult] = await Promise.allSettled([
    pool.query<Row>(`${DIGITAL_WORK_ROWS_SQL} ORDER BY w.created_at,w.id`),
    pool.query<{id:string;accion:string;title:string;created_at:Date;actor:string;proyecto_id:string}>(`WITH scope AS (${scope})
      SELECT l.id,l.accion,l.created_at,l.proyecto_id,coalesce(u.nombre,'Equipo PanHouse') actor,
      coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title
      FROM audit_logs l JOIN scope s ON s.id=l.proyecto_id JOIN proyectos p ON p.id=s.id LEFT JOIN usuarios u ON u.id=l.actor_id
      WHERE l.accion IN ('AMAZON_ACTIVACION_HABILITADA','AMAZON_ACTIVACION_REGISTRADA')
      OR (l.accion='FICHA_DOCUMENTAL_ACTUALIZADA' AND (l.detalles->>'area'='digital' OR
        (l.detalles->>'area'='diseno' AND coalesce(l.detalles->'campos','[]'::jsonb) ?| array['paqueteFinalCargado','paqueteFinalEntrega','paqueteFinalArchivos'])))
      ORDER BY l.created_at DESC,l.id DESC LIMIT 6`),
  ]);
  if (workResult.status === 'rejected') throw workResult.reason;
  const rows = workResult.value.rows;
  const today = diaCaracas(now);
  const projects = new Map<string, Row>();
  for (const r of rows) projects.set(r.proyecto_id, r);
  const summary: DigitalCounts = { preparation: 0, testing: 0, loaded: 0, completed: 0 };
  for (const r of projects.values()) if (r.project_state !== 'culminado' || stage(r) === 'completed') summary[stage(r)]++;
  // w.estado='completado' acá solo refleja que la activación (el único
  // sub-paso que hoy transiciona el work item, ver actualizarSeccionSoporteDigital
  // en trazabilidad.ts) ya ocurrió -- NO que el proceso digital completo
  // terminó. Filtrar por esa columna escondía el proyecto de "Mis tareas
  // prioritarias" apenas se registraba la activación, aunque pruebas/carga/
  // cierre todavía estuvieran pendientes (bug real encontrado en la
  // auditoría, ver tests). stage(r)==='completed' (digital_estatus real)
  // es la única señal correcta de "ya no queda nada por hacer aquí".
  const tasks = rows.filter(r => r.project_state !== 'culminado').map(r => toTask(r, today)).sort(compareDigitalTasks);
  const labels: Record<string,string> = { AMAZON_ACTIVACION_HABILITADA: 'Activación Amazon habilitada', AMAZON_ACTIVACION_REGISTRADA: 'Activación Amazon registrada', FICHA_DOCUMENTAL_ACTUALIZADA: 'Hitos digitales o paquete final actualizados' };
  return {
    today, summary, priorityTasks: tasks.slice(0,6),
    flowSummary: { counts: summary, activeTasks: tasks.length, waitingPackage: [...projects.values()].filter(r => r.project_state !== 'culminado' && stage(r) !== 'completed' && !!r.activation && !r.package_available).length,
      pausedProjects: [...projects.values()].filter(r => r.project_state === 'pausado').length },
    recentActivity: { items: activityResult.status === 'fulfilled' ? activityResult.value.rows.map(r => ({ id:r.id,label:labels[r.accion]!,projectTitle:r.title,at:r.created_at.toISOString(),actor:r.actor,href:digitalWorkUrl(r.proyecto_id) })) : [], unavailable: activityResult.status === 'rejected' },
  };
}
