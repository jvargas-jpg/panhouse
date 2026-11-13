import { and, eq, isNull } from 'drizzle-orm';
import { disenos, disenoVersiones, fichaCalidadFases, notificaciones, projectAssignments, proyectos, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';
import { asignarConHistorial } from './assignments.js';

// Cover validation uses the existing canonical work item and its metadata.
// It never fabricates a Quality phase, nor replaces creative/internal approval.
type QualityRound = typeof fichaCalidadFases.$inferSelect;
export type ValidationRound = Pick<QualityRound,
  'id' | 'workItemId' | 'disenoVersionId' | 'numeroFase' | 'ronda' | 'pdfVersion' |
  'validatorRequestedAt' | 'validatorRequestedById' | 'dueAt' | 'iniciadoEn' |
  'iniciadoPorId' | 'revisadoEn' | 'revisadoPorId' | 'aprobado' | 'commentsUpload' |
  'decisionKey' | 'cantidadComentarios' | 'cantidadPaginas' | 'observaciones' |
  'comentariosUrl' | 'nombreQuienRecibe' | 'numerosLegalesUrl'>;
const dates = ['validatorRequestedAt', 'dueAt', 'iniciadoEn', 'revisadoEn'] as const;
export function coverRound(work: typeof workItems.$inferSelect): ValidationRound {
  const q: ValidationRound = JSON.parse(work.observaciones ?? '{}').validation;
  if (!q || q.id !== work.id || q.workItemId !== work.id || q.disenoVersionId !== work.businessKey) throw new Error('Trabajo de cubierta inconsistente');
  for (const key of dates) if (q[key]) q[key] = new Date(q[key]!);
  return q;
}
export async function saveValidationRound(tx: Tx, c: { q: ValidationRound; isCover: boolean }, changes: Partial<QualityRound>) {
  if (c.isCover) {
    await tx.update(workItems).set({ observaciones: JSON.stringify({ validation: { ...c.q, ...changes } }) }).where(eq(workItems.id, c.q.id));
  } else await tx.update(fichaCalidadFases).set(changes).where(eq(fichaCalidadFases.id, c.q.id));
}
export async function createCoverValidation(tx: Tx, d: typeof disenos.$inferSelect, p: typeof proyectos.$inferSelect, v: typeof disenoVersiones.$inferSelect, previous?: typeof disenoVersiones.$inferSelect) {
  const id = await crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'validacion_cubierta', businessKey: v.id });
  const [existing] = await tx.select().from(workItems).where(eq(workItems.id, id));
  if (existing?.observaciones) { coverRound(existing); return id; }
  const [old] = previous ? await tx.select().from(workItems).where(and(eq(workItems.tipo, 'validacion_cubierta'), eq(workItems.businessKey, previous.id), eq(workItems.proyectoId, p.id))) : [];
  const prior = old ? coverRound(old) : null;
  const q: ValidationRound = { id, workItemId: id, disenoVersionId: v.id, numeroFase: 0, ronda: (prior?.ronda ?? 0) + 1, pdfVersion: `V${v.numero}`, validatorRequestedAt: prior?.validatorRequestedAt ?? null, validatorRequestedById: prior?.validatorRequestedById ?? null, dueAt: prior?.dueAt ?? null, iniciadoEn: null, iniciadoPorId: null, revisadoEn: null, revisadoPorId: null, aprobado: null, commentsUpload: null, decisionKey: null, cantidadComentarios: null, cantidadPaginas: null, observaciones: null, comentariosUrl: null, nombreQuienRecibe: null, numerosLegalesUrl: null };
  await saveValidationRound(tx, { q, isCover: true }, {});
  if (old && !['completado', 'cancelado'].includes(old.estado)) await transicionarWorkItemPorId(tx, old.id, 'cancelado');
  const [a] = old ? await tx.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId, old.id), eq(projectAssignments.tipo, 'validador'), isNull(projectAssignments.finalizadoEn))) : [];
  if (a) {
    await asignarConHistorial(tx, { proyectoId: p.id, workItemId: id, tipo: 'validador', usuarioId: a.usuarioId, asignadoPorId: a.asignadoPorId });
    await tx.insert(notificaciones).values({ proyectoId: p.id, rolDestino: 'validador', usuarioDestinoId: a.usuarioId, mensaje: `Soporte Editorial · Revisión de cubierta: Diseño entregó V${v.numero} al Validador asignado.`, targetPath: `/?validacion=${id}` });
  }
  return id;
}
