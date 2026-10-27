import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { correccionBlockers, correccionDeliveries, correcciones as correccionesTable, notificaciones, projectDriveWorkspaces, workItems as workItemsTable } from '../db/schema/index.js';
import { listarMisCorrecciones, type TrabajoCorrector } from './correcciones.js';
import { specialistsFor } from './editorialProjects.js';
import { obtenerEspecialistaActual } from './carga.js';
import { diaCaracas } from './atencionEspecialista.js';
import { registrarEvento } from './auditLog.js';
import { transicionarWorkItemPorId } from './workItems.js';
import { getProjectWorkspaceFolders } from '../modules/project-workspaces/service.js';
import { lockCorrectorWork, correctorError, correctorWorkContext } from './correctorAccess.js';
import { CORRECCION_FOLDER_KEYS, validateCorreccionDriveFile } from './correccionDrive.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import type { CorrectorWorkDetail, CorrectorWorkFilters, CorrectorWorkList, CorrectorWorkRow, CorrectorWorkStatus } from '../../shared/correctorWork.js';

const EVENTS: Record<string, string> = {
  CORRECCION_SOLICITADA: 'Corrección solicitada', CORRECTOR_ASIGNADO: 'Corrector asignado', CORRECTOR_REASIGNADO: 'Corrector reasignado',
  CORRECCION_INICIADA: 'Corrección iniciada', CORRECCION_ENTREGA_REGISTRADA: 'Entrega registrada', CORRECCION_ENTREGADA: 'Corrección entregada',
  CORRECCION_CERRADA: 'Corrección cerrada', CORRECCION_BLOQUEO_REPORTADO: 'Bloqueo reportado',
};

const ETIQUETA_ALCANCE: Record<string, string> = { tripa_completa: 'Tripa completa', preliminares: 'Preliminares', cubierta_extendida: 'Cubierta extendida' };
function etiquetaAlcance(alcance: string): string {
  return ETIQUETA_ALCANCE[alcance] ?? (alcance.includes('-') ? `${ETIQUETA_ALCANCE[alcance.split('-')[0]!] ?? alcance} · ronda ${alcance.split('-')[1]}` : alcance);
}

function estadoFila(t: TrabajoCorrector): CorrectorWorkStatus {
  if (t.estado === 'completado') return 'completada';
  if (t.estado === 'bloqueado') return 'bloqueada';
  if (t.fechaInicio) return 'en_correccion';
  return 'asignada';
}
const STATUS_LABEL: Record<CorrectorWorkStatus, string> = { asignada: 'Asignada', en_correccion: 'En corrección', bloqueada: 'Bloqueada', completada: 'Completada' };
const CTA: Record<CorrectorWorkStatus, string> = { asignada: 'Abrir trabajo', en_correccion: 'Continuar', bloqueada: 'Ver bloqueo', completada: 'Ver entrega' };

// Orden por defecto (master prompt Mi trabajo §29): vencidas accionables,
// vencen pronto, bloqueadas, en proceso, asignadas -- completadas quedan
// fuera de Activas. Deriva de señales ya calculadas (status/plazo), nunca
// una prioridad inventada aparte del dominio.
function prioridad(row: CorrectorWorkRow): number {
  if (row.status !== 'completada' && row.deadlineState === 'vencido') return 0;
  if (row.status !== 'completada' && row.deadlineState === 'proximo_a_vencer') return 1;
  if (row.status === 'bloqueada') return 2;
  if (row.status === 'en_correccion') return 3;
  if (row.status === 'asignada') return 4;
  return 5;
}

function fila(t: TrabajoCorrector): CorrectorWorkRow {
  const status = estadoFila(t);
  return {
    id: t.workItemId, correctionId: t.id, projectId: t.proyectoId, projectCode: t.proyectoCodigo,
    title: t.proyectoTitulo ?? `${t.autorNombre} · ${t.proyectoCodigo}`, authors: t.autorNombre, coverUrl: null,
    intervention: etiquetaAlcance(t.alcance), scope: t.alcance,
    status, statusLabel: STATUS_LABEL[status],
    deadline: t.dueAt ? t.dueAt.toISOString() : null, deadlineState: t.plazo,
    blocker: status === 'bloqueada' ? (t.gateBloqueante ?? null) : null,
    lastActivity: null, completedAt: t.entregadoEn ? t.entregadoEn.toISOString() : (t.fechaEntrega ? t.fechaEntrega + 'T12:00:00Z' : null),
    actionable: status === 'asignada' || status === 'en_correccion', cta: CTA[status],
  };
}

// Última actividad por fila (mismo patrón que withLastActivity en
// editorWork.ts): una sola consulta por página visible, nunca por fila.
async function withLastActivity(rows: CorrectorWorkRow[]): Promise<CorrectorWorkRow[]> {
  const ids = rows.map(r => r.id);
  if (!ids.length) return rows;
  const { rows: activity } = await pool.query<{ entity_id: string; accion: string; created_at: Date }>(
    `SELECT DISTINCT ON (entity_id) entity_id,accion,created_at FROM audit_logs WHERE entity_id=ANY($1::uuid[]) ORDER BY entity_id,created_at DESC,id DESC`, [ids]);
  const latest = new Map(activity.map(a => [a.entity_id, a]));
  return rows.map(r => {
    const a = latest.get(r.id);
    return a ? { ...r, lastActivity: { label: EVENTS[a.accion] ?? a.accion, at: a.created_at.toISOString() } } : r;
  });
}

export async function listarMiTrabajoCorrector(correctorId: string, f: CorrectorWorkFilters): Promise<CorrectorWorkList> {
  const all = (await listarMisCorrecciones(correctorId)).map(fila);
  const search = f.search.trim().toLocaleLowerCase('es');
  const filtered = all.filter(r =>
    (!search || `${r.title} ${r.authors} ${r.intervention} ${r.projectCode}`.toLocaleLowerCase('es').includes(search)) &&
    (!f.status || r.status === f.status) && (!f.scope || r.scope === f.scope) && (!f.project || r.projectId === f.project));
  const inTab = (r: CorrectorWorkRow) => f.tab === 'all' ? true : f.tab === 'completed' ? r.status === 'completada' : r.status !== 'completada';
  const counts = {
    active: filtered.filter(r => r.status !== 'completada').length,
    completed: filtered.filter(r => r.status === 'completada').length,
    all: filtered.length,
  };
  const bucket = filtered.filter(inTab).sort((a, b) => prioridad(a) - prioridad(b) || (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(bucket.length / f.pageSize)), page = Math.min(f.page, pages);
  const pageItems = await withLastActivity(bucket.slice((page - 1) * f.pageSize, page * f.pageSize));
  const options = { projects: [...new Map(all.map(r => [r.projectId, { id: r.projectId, name: r.title }])).values()] };
  return { items: pageItems, total: bucket.length, pages, page, counts, options };
}

export async function obtenerDetalleTrabajoCorrector(workItemId: string, correctorId: string): Promise<CorrectorWorkDetail | null> {
  const all = await listarMisCorrecciones(correctorId);
  const t = all.find(x => x.workItemId === workItemId);
  if (!t) return null;
  const summary = fila(t);
  const [specialists, folderResult, deliveries, blocker, history] = await Promise.all([
    specialistsFor([t.proyectoId]),
    summary.status === 'completada' ? Promise.resolve({ folders: [], unavailable: false }) :
      getProjectWorkspaceFolders(t.proyectoId, { id: correctorId, rol: 'corrector' }).then(folders => ({ folders, unavailable: false }), () => ({ folders: [], unavailable: true })),
    db.select().from(correccionDeliveries).where(eq(correccionDeliveries.workItemId, workItemId)).orderBy(desc(correccionDeliveries.submittedAt)),
    db.select().from(correccionBlockers).where(and(eq(correccionBlockers.workItemId, workItemId), isNull(correccionBlockers.resolvedAt))).then(r => r[0] ?? null),
    pool.query<{ id: string; accion: string; actor: string; created_at: Date }>(
      `SELECT a.id,a.accion,coalesce(u.nombre,'Sistema') actor,a.created_at FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
       WHERE a.entity_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 15`, [workItemId]),
  ]);
  const labels = Object.fromEntries(CORRECCION_FOLDER_KEYS.map(f => [f.key, f.label]));
  const folders = folderResult.folders.filter(f => labels[f.key]).map(f => ({ key: f.key, label: labels[f.key]!, driveUrl: f.driveUrl }));
  const [row] = await withLastActivity([summary]);
  return {
    summary: row!, assignedAt: t.fechaAsignada ? t.fechaAsignada + 'T12:00:00Z' : null, specialist: specialists.get(t.proyectoId)?.nombre ?? null,
    folders, materialUnavailable: folderResult.unavailable,
    slaLabel: `${t.alcance === 'tripa_completa' ? '120' : '12'} horas continuas desde la asignación`,
    deliveries: deliveries.map(d => ({ id: d.id, tripaDriveUrl: d.tripaDriveUrl, reportDriveUrl: d.reportDriveUrl, observaciones: d.observaciones, submittedAt: d.submittedAt.toISOString() })),
    blocker: blocker ? { id: blocker.id, reason: blocker.reason, createdAt: blocker.createdAt.toISOString(), resolvedAt: null, resolution: null } : null,
    history: history.rows.map(h => ({ id: h.id, label: EVENTS[h.accion] ?? h.accion, actor: h.actor, at: h.created_at.toISOString() })),
  };
}

// Entrega segura (master prompt Mi trabajo §41-54): exige los DOS
// deliverables, valida cada enlace contra el espacio documental real del
// proyecto (correccionDrive.ts, misma ancestría que Editor) ANTES de
// escribir, y revalida la asignación DENTRO de la transacción (si el
// corrector fue reasignado mientras esta llamada estaba en vuelo, falla
// con 403 en vez de registrar la entrega a nombre de quien ya no es
// responsable). Idempotente: un retry con los mismos dos archivos sobre
// una corrección ya completada por el mismo actor devuelve la entrega
// existente sin duplicar fila ni aviso.
export async function registrarEntregaCorrectorConArchivos(
  workItemId: string, actorId: string, input: { tripaUrl: string; reportUrl: string; observaciones?: string },
  operate: CorporateDriveOperation = withCorporateDrive,
) {
  await correctorWorkContext(workItemId, actorId);
  const [tripa, informe] = await Promise.all([
    validateCorreccionDriveFile(workItemId, actorId, input.tripaUrl, operate),
    validateCorreccionDriveFile(workItemId, actorId, input.reportUrl, operate),
  ]);
  if (tripa.driveFileId === informe.driveFileId) throw correctorError('La tripa corregida y el informe técnico deben ser archivos distintos', 400);
  return db.transaction(async tx => {
    const { item, correccion, project } = await lockCorrectorWork(tx, workItemId, actorId);
    const [ws] = await tx.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.id, tripa.workspaceId));
    if (!ws || ws.status !== 'READY' || ws.storageContextId !== tripa.storageContextId) throw correctorError('El espacio documental cambió; vuelve a seleccionar los archivos');
    const [last] = await tx.select().from(correccionDeliveries).where(eq(correccionDeliveries.workItemId, workItemId)).orderBy(desc(correccionDeliveries.submittedAt)).limit(1);
    if (item.estado === 'completado' && last?.tripaDriveFileId === tripa.driveFileId && last.reportDriveFileId === informe.driveFileId && last.submittedBy === actorId) return last;
    const [delivery] = await tx.insert(correccionDeliveries).values({
      projectId: correccion.proyectoId, workItemId, tripaDriveUrl: tripa.driveUrl, tripaDriveFileId: tripa.driveFileId,
      reportDriveUrl: informe.driveUrl, reportDriveFileId: informe.driveFileId, observaciones: input.observaciones ?? null, submittedBy: actorId,
    }).returning();
    const ahora = new Date();
    await tx.update(correccionesTable).set({
      entregadoEn: ahora, fechaEntrega: diaCaracas(ahora), controlCambiosUrl: tripa.driveUrl, informeTecnicoUrl: informe.driveUrl,
    }).where(eq(correccionesTable.id, correccion.id));
    await transicionarWorkItemPorId(tx, workItemId, 'completado');
    await registrarEvento(tx, {
      actorId, accion: 'CORRECCION_ENTREGA_REGISTRADA', entityType: 'work_item', entityId: workItemId, proyectoId: correccion.proyectoId,
      detalles: { deliveryId: delivery!.id, tripaDriveFileId: tripa.driveFileId, reportDriveFileId: informe.driveFileId },
    });
    const especialista = await obtenerEspecialistaActual(correccion.proyectoId, project.especialistaId, tx);
    if (especialista) await tx.insert(notificaciones).values({
      proyectoId: correccion.proyectoId, rolDestino: 'especialista', usuarioDestinoId: especialista,
      targetPath: '/proyectos/' + correccion.proyectoId, mensaje: 'Corrección entregada — lista para tu revisión de cierre.',
    });
    return delivery!;
  });
}

export async function reportarBloqueoCorreccion(workItemId: string, reason: string, actorId: string) {
  return db.transaction(async tx => {
    if (reason.trim().length < 5 || reason.trim().length > 1000) throw correctorError('Escribe un motivo de entre 5 y 1000 caracteres', 400);
    const { item, correccion, project } = await lockCorrectorWork(tx, workItemId, actorId);
    if (['completado', 'cancelado'].includes(item.estado)) throw correctorError('La intervención ya no admite un bloqueo');
    const [existing] = await tx.select({ id: correccionBlockers.id }).from(correccionBlockers).where(and(eq(correccionBlockers.workItemId, workItemId), isNull(correccionBlockers.resolvedAt)));
    if (existing) throw correctorError('Ya hay un bloqueo abierto para esta intervención', 409);
    const [blocker] = await tx.insert(correccionBlockers).values({ workItemId, reason, createdBy: actorId }).returning();
    await tx.update(workItemsTable).set({ estado: 'bloqueado', gateBloqueante: reason }).where(eq(workItemsTable.id, workItemId));
    await registrarEvento(tx, { actorId, accion: 'CORRECCION_BLOQUEO_REPORTADO', entityType: 'work_item', entityId: workItemId, proyectoId: correccion.proyectoId, detalles: { reason } });
    const especialista = await obtenerEspecialistaActual(correccion.proyectoId, project.especialistaId, tx);
    if (especialista) await tx.insert(notificaciones).values({ proyectoId: correccion.proyectoId, rolDestino: 'especialista', usuarioDestinoId: especialista, targetPath: '/proyectos/' + correccion.proyectoId, mensaje: 'El Corrector reportó un bloqueo: ' + reason.trim() });
    return blocker!;
  });
}
