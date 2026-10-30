import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs, notificaciones, pagos, proyectos, projectDriveWorkspaces, users, workItems } from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { getProjectFinancialStatus } from './estadoFinanciero.js';
import type { Tx } from './tx.js';
import type { FinancialDetail } from '../../shared/pagos.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { obtenerEspecialistaActual } from './carga.js';
import { ROLES_CONFIRMACION_PAGOS, ROLES_REGISTRO_PAGOS } from '../../shared/pagos.js';

export const paymentError = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export interface PaymentActor { id: string; rol: string }
export interface NewPayment {
  proyectoId: string; monto: string; moneda?: string; fechaPago: string; metodoPago: string;
  referencia?: string | null; comprobanteUrl?: string | null; notas?: string | null;
  idempotencyKey?: string; motivoAdministrativo?: string;
}
export function requireAdminReason(actor: PaymentActor, motivo?: string) {
  if (actor.rol === 'admin' && !motivo?.trim()) throw paymentError('La intervención administrativa requiere un motivo');
}
async function lockedProject(tx: Tx, id: string) {
  const [p] = await tx.select().from(proyectos).where(eq(proyectos.id, id)).for('update');
  if (!p) throw paymentError('Proyecto no encontrado', 404);
  return p;
}
async function checkCurrency(tx: Tx, id: string, currency: string, contractual: string | null) {
  const r = await tx.execute(sql`SELECT DISTINCT moneda FROM pagos WHERE proyecto_id=${id}::uuid AND estatus IN ('Verificado','Pendiente de verificación')`);
  if ((contractual && contractual !== currency) || r.rows.some(r => r.moneda !== currency))
    throw paymentError('La moneda debe coincidir con el contrato y los abonos vigentes');
}
async function notifyGateChange(tx: Tx, p: typeof proyectos.$inferSelect, before: string | undefined, after: string | undefined) {
  if (before === after) return;
  const mensaje = `El gate de solvencia del proyecto cambió: ${after}.`;
  await tx.insert(notificaciones).values({ proyectoId:p.id,rolDestino:'comercial',mensaje,targetPath:`/comercial/pagos?project=${p.id}` });
  const specialist = await obtenerEspecialistaActual(p.id,p.especialistaId,tx);
  if (specialist) await tx.insert(notificaciones).values({ proyectoId:p.id,rolDestino:'especialista',usuarioDestinoId:specialist,mensaje,targetPath:`/proyectos/${p.id}` });
  const [digital] = await tx.select({ id:workItems.id }).from(workItems).where(and(eq(workItems.proyectoId,p.id),eq(workItems.tipo,'soporte_digital'),sql`${workItems.estado} IN ('pendiente','en_progreso','bloqueado')`)).limit(1);
  if (digital) await tx.insert(notificaciones).values({ proyectoId:p.id,rolDestino:'soporte_digital',mensaje,targetPath:`/proyectos/${p.id}` });
}

export async function validatePaymentReceipt(projectId: string, url: string, operate: CorporateDriveOperation = withCorporateDrive) {
  const match = /^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)\/(?:view|preview)(?:\?[^#]*)?$/.exec(url);
  if (!match) throw paymentError('Usa un comprobante PDF o imagen del Drive de este proyecto');
  const [ws] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, projectId));
  if (!ws?.rootFolderId || ws.status !== 'READY') throw paymentError('El proyecto necesita un espacio Drive disponible para vincular comprobantes');
  return operate(async ({ integration, storage }) => {
    if (integration.id !== ws.integrationId || integration.storageContextId !== ws.storageContextId) throw paymentError('La conexión documental cambió', 409);
    const file = await storage.getMetadata(match[1]!);
    if (file.trashed || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.mimeType) || !file.size || file.size > 5 * 1024 * 1024)
      throw paymentError('El comprobante debe ser PDF, PNG o JPG y pesar como máximo 5 MB');
    let parents = file.parents;
    const seen = new Set<string>();
    for (let depth = 0; depth < 16 && parents.length; depth++) {
      if (parents.includes(ws.rootFolderId!)) return `https://drive.google.com/file/d/${file.providerFileId}/view`;
      const next: string[] = [];
      for (const parent of parents) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        const folder = await storage.getMetadata(parent);
        if (!folder.trashed) next.push(...folder.parents);
      }
      parents = next;
    }
    throw paymentError('El comprobante no pertenece al proyecto', 403);
  });
}

export async function registrarPago(datos: NewPayment, actor: PaymentActor) {
  if (!(ROLES_REGISTRO_PAGOS as readonly string[]).includes(actor.rol)) throw paymentError('El registro de pagos corresponde a Comercial',403);
  requireAdminReason(actor, datos.motivoAdministrativo);
  const { idempotencyKey, motivoAdministrativo, ...input } = datos;
  const moneda = input.moneda ?? 'USD'; // Política legacy del registro, no del contrato.
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, moneda, motivoAdministrativo })).digest('hex');
  return db.transaction(async tx => {
    if (idempotencyKey) await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${actor.id + idempotencyKey},0))`);
    const p = await lockedProject(tx, input.proyectoId);
    if (idempotencyKey) {
      const [old] = await tx.select().from(pagos).where(and(eq(pagos.registradoPorId, actor.id), eq(pagos.idempotencyKey, idempotencyKey)));
      if (old) {
        if (old.requestFingerprint !== fingerprint) throw paymentError('La clave de registro ya se utilizó con otros datos', 409);
        return old;
      }
    }
    if (['retirado','culminado'].includes(p.estado)) throw paymentError('No se pueden registrar abonos en un proyecto retirado o culminado', 409);
    await checkCurrency(tx, p.id, moneda, p.monedaContractual);
    const comprobanteUrl = input.comprobanteUrl ? await validatePaymentReceipt(p.id, input.comprobanteUrl) : null;
    const financialBefore = await getProjectFinancialStatus(p.id,tx);
    const [pago] = await tx.insert(pagos).values({ ...input, moneda, comprobanteUrl, registradoPorId: actor.id,
      estatus:'Verificado',confirmadoPorId:actor.id,confirmadoEn:new Date(),
      idempotencyKey, requestFingerprint: fingerprint, origen: 'INTERNAL_TEMPORARY' }).returning();
    await registrarEvento(tx, { actorId: actor.id, accion: 'PAYMENT_REGISTERED', entityType: 'pago', entityId: pago!.id, proyectoId: p.id,
      detalles: { amount: pago!.monto, currency: moneda, before: null, after: pago!.estatus, motivoAdministrativo } });
    await registrarEvento(tx, { actorId:actor.id,accion:'PAYMENT_CONFIRMED',entityType:'pago',entityId:pago!.id,proyectoId:p.id,
      detalles:{ amount:pago!.monto,currency:moneda,before:null,after:'Verificado',reason:'Pago recibido declarado al registrar',motivoAdministrativo } });
    const after = await getProjectFinancialStatus(p.id,tx);
    if (after?.paymentStatus==='Sobrepago' && financialBefore?.paymentStatus!=='Sobrepago') {
      await registrarEvento(tx,{ actorId:actor.id,accion:'PAYMENT_OVERPAYMENT',entityType:'pago',entityId:pago!.id,proyectoId:p.id });
      await tx.insert(notificaciones).values({ proyectoId:p.id,rolDestino:'comercial',mensaje:'Revisar sobrepago del proyecto.',targetPath:`/comercial/pagos?project=${p.id}` });
    }
    await tx.update(proyectos).set({ updatedAt: new Date() }).where(eq(proyectos.id, p.id));
    return pago!;
  });
}

export async function transitionPayment(id: string, next: 'Verificado' | 'Rechazado' | 'Anulado', reason: string | undefined, actor: PaymentActor, adminReason?: string) {
  if (!(ROLES_CONFIRMACION_PAGOS as readonly string[]).includes(actor.rol)) throw paymentError('La decisión de pagos corresponde a Comercial',403);
  requireAdminReason(actor, adminReason);
  if (next !== 'Verificado' && !reason?.trim()) throw paymentError('El motivo es obligatorio');
  return db.transaction(async tx => {
    const [origin] = await tx.select().from(pagos).where(eq(pagos.id, id));
    if (!origin) return undefined;
    const p = await lockedProject(tx, origin.proyectoId);
    const [before] = await tx.select().from(pagos).where(eq(pagos.id, id)).for('update');
    if (before!.estatus === 'Anulado' || (next !== 'Anulado' && before!.estatus !== 'Pendiente de verificación'))
      throw paymentError('El pago ya fue procesado. Actualiza el historial.', 409);
    if (next === 'Verificado') await checkCurrency(tx, p.id, before!.moneda, p.monedaContractual);
    const financialBefore = await getProjectFinancialStatus(p.id, tx);
    await tx.update(proyectos).set({ updatedAt: new Date() }).where(eq(proyectos.id, p.id));
    const [pago] = await tx.update(pagos).set({ estatus: next,
      ...(next === 'Anulado' ? { anuladoPorId: actor.id, anuladoEn: new Date(), motivoAnulacion: reason!.trim() }
        : { motivoRechazo: next === 'Rechazado' ? reason!.trim() : null,
          confirmadoPorId: next === 'Verificado' ? actor.id : null, confirmadoEn: next === 'Verificado' ? new Date() : null }),
    }).where(eq(pagos.id, id)).returning();
    if (next === 'Anulado' && before!.estatus === 'Verificado' && p.solvenciaEstado === 'Solvente') {
      await tx.update(proyectos).set({ solvenciaEstado: 'Pendiente', solvenciaPorId: null, solvenciaEn: null, solvenciaMotivo: 'Pago confirmado anulado; revisar solvencia' }).where(eq(proyectos.id, p.id));
      await registrarEvento(tx, { actorId: actor.id, accion: 'SOLVENCY_CHANGED', entityType: 'proyecto', entityId: p.id, proyectoId: p.id,
        detalles: { before: 'Solvente', after: 'Pendiente', paymentId: id, reason } });
      if (p.gateFinancieroRequerido) await registrarEvento(tx, { actorId: actor.id, accion: 'FINANCIAL_GATE_CHANGED', entityType: 'proyecto', entityId: p.id, proyectoId: p.id, detalles: { before: 'Liberado', after: 'Bloqueado', paymentId: id } });
    }
    const after = await getProjectFinancialStatus(p.id, tx);
    await notifyGateChange(tx,p,financialBefore?.financialGateStatus,after?.financialGateStatus);
    await registrarEvento(tx, { actorId: actor.id, accion: next === 'Anulado' ? 'PAYMENT_VOIDED' : next === 'Verificado' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_REJECTED',
      entityType: 'pago', entityId: id, proyectoId: p.id, detalles: { amount: pago!.monto, currency: pago!.moneda, before: before!.estatus, after: next, reason, motivoAdministrativo: adminReason } });
    if (after?.paymentStatus === 'Sobrepago' && financialBefore?.paymentStatus !== 'Sobrepago') {
      await registrarEvento(tx, { actorId: actor.id, accion: 'PAYMENT_OVERPAYMENT', entityType: 'pago', entityId: id, proyectoId: p.id });
      await tx.insert(notificaciones).values({ proyectoId: p.id, rolDestino: 'comercial', mensaje: 'Revisar sobrepago del proyecto.', targetPath: `/comercial/pagos?project=${p.id}` });
    }
    if (before!.registradoPorId && before!.registradoPorId !== actor.id) {
      const [r] = await tx.select({ rol: users.rol }).from(users).where(eq(users.id, before!.registradoPorId));
      if (r) await tx.insert(notificaciones).values({ proyectoId: p.id, rolDestino: r.rol, usuarioDestinoId: before!.registradoPorId,
        mensaje: `Abono ${next.toLowerCase()}. Consulta el historial del proyecto.`, targetPath: `/comercial/pagos?project=${p.id}` });
    }
    return pago!;
  });
}

export async function financialDetail(id: string, historyPage = 1): Promise<FinancialDetail | undefined> {
  return db.transaction(async tx => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
    const financial = await getProjectFinancialStatus(id, tx);
    if (!financial) return undefined;
    const history = await tx.execute(sql`SELECT p.id,p.proyecto_id "proyectoId",p.monto,p.moneda,p.fecha_pago::text "fechaPago",p.metodo_pago "metodoPago",
      p.referencia,p.notas,p.estatus,p.motivo_rechazo "motivoRechazo",r.nombre "registradoPor",p.created_at::text "registradoEn",c.nombre "confirmadoPor",p.confirmado_en::text "confirmadoEn",
      v.nombre "anuladoPor",p.anulado_en::text "anuladoEn",p.motivo_anulacion "motivoAnulacion",p.origen,p.comprobante_url IS NOT NULL "tieneComprobante"
      FROM pagos p LEFT JOIN usuarios r ON r.id=p.registrado_por_id LEFT JOIN usuarios c ON c.id=p.confirmado_por_id LEFT JOIN usuarios v ON v.id=p.anulado_por_id
      WHERE p.proyecto_id=${id}::uuid ORDER BY p.fecha_pago DESC,p.created_at DESC,p.id DESC LIMIT 20 OFFSET ${(historyPage - 1) * 20}`);
    const [meta] = await tx.select({ revision: proyectos.updatedAt, financialNotes: proyectos.solvenciaMotivo, solvencyAt: proyectos.solvenciaEn, solvencyBy: users.nombre }).from(proyectos)
      .leftJoin(users, eq(users.id, proyectos.solvenciaPorId)).where(eq(proyectos.id, id));
    const counts = await tx.execute(sql`SELECT count(*)::int count FROM pagos WHERE proyecto_id=${id}::uuid`);
    const audit = await tx.select({ accion: auditLogs.accion, fecha: auditLogs.createdAt, actor: users.nombre }).from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId)).where(and(eq(auditLogs.proyectoId, id), sql`${auditLogs.accion} IN ('PAYMENT_REGISTERED','PAYMENT_CONFIRMED','PAYMENT_REJECTED','PAYMENT_VOIDED','SOLVENCY_CHANGED','FINANCIAL_GATE_CHANGED','CONTRACT_AMOUNT_CHANGED')`))
      .orderBy(desc(auditLogs.createdAt)).limit(8);
    return { ...financial, ...meta, revision: meta!.revision.toISOString(), solvencyAt: meta?.solvencyAt?.toISOString() ?? null, historyPage, historyTotal: counts.rows[0]!.count,
      payments: history.rows, auditSummary: audit.map(a => ({ ...a, fecha: a.fecha.toISOString() })) } as unknown as FinancialDetail;
  });
}

export async function updateFinancialContract(id: string, input: { monto: string; moneda: string; motivo: string; expectedUpdatedAt: string }, actor: PaymentActor) {
  return db.transaction(async tx => {
    const p = await lockedProject(tx, id);
    if (p.updatedAt.toISOString() !== input.expectedUpdatedAt) throw paymentError('El proyecto cambió. Actualiza antes de guardar.', 409);
    if (p.montoContractual === input.monto && p.monedaContractual === input.moneda) return getProjectFinancialStatus(id,tx);
    const before = await getProjectFinancialStatus(id,tx);
    await checkCurrency(tx, id, input.moneda, null);
    await tx.update(proyectos).set({ montoContractual: input.monto, monedaContractual: input.moneda,
      solvenciaEstado: 'Pendiente', solvenciaPorId: null, solvenciaEn: null, solvenciaMotivo: 'Contrato actualizado; revisar solvencia' }).where(eq(proyectos.id, id));
    await registrarEvento(tx, { actorId: actor.id, accion: 'CONTRACT_AMOUNT_CHANGED', entityType: 'proyecto', entityId: id, proyectoId: id,
      detalles: { before: { amount: p.montoContractual, currency: p.monedaContractual }, after: { amount: input.monto, currency: input.moneda }, reason: input.motivo } });
    if (p.solvenciaEstado !== 'Pendiente') await registrarEvento(tx, { actorId: actor.id, accion: 'SOLVENCY_CHANGED', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { before: p.solvenciaEstado, after: 'Pendiente', reason: 'Cambio contractual' } });
    if (p.gateFinancieroRequerido && p.solvenciaEstado === 'Solvente') await registrarEvento(tx, { actorId: actor.id, accion: 'FINANCIAL_GATE_CHANGED', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { before: 'Liberado', after: 'Bloqueado', reason: 'Cambio contractual' } });
    const status = await getProjectFinancialStatus(id, tx);
    await notifyGateChange(tx,p,before?.financialGateStatus,status?.financialGateStatus);
    await tx.insert(notificaciones).values({ proyectoId:id,rolDestino:'comercial',mensaje:'Se actualizó el contrato del proyecto. Revisa la solvencia.',targetPath:`/comercial/pagos?project=${id}` });
    if (status?.paymentStatus === 'Sobrepago') await tx.insert(notificaciones).values({ proyectoId: id, rolDestino: 'comercial', mensaje: 'Revisar sobrepago después de un cambio contractual.', targetPath: `/comercial/pagos?project=${id}` });
    return status;
  });
}

export async function updateSolvency(id: string, input: { estado: string; gateRequired: boolean; motivo: string; expectedUpdatedAt: string }, actor: PaymentActor) {
  if (!(ROLES_CONFIRMACION_PAGOS as readonly string[]).includes(actor.rol)) throw paymentError('La solvencia corresponde a Comercial',403);
  return db.transaction(async tx => {
    const p = await lockedProject(tx, id);
    if (p.updatedAt.toISOString() !== input.expectedUpdatedAt) throw paymentError('La solvencia cambió. Actualiza el detalle.', 409);
    const before = await getProjectFinancialStatus(id, tx);
    await tx.update(proyectos).set({ solvenciaEstado: input.estado, gateFinancieroRequerido: input.gateRequired,
      solvenciaPorId: actor.id, solvenciaEn: new Date(), solvenciaMotivo: input.motivo }).where(eq(proyectos.id, id));
    await registrarEvento(tx, { actorId: actor.id, accion: 'SOLVENCY_CHANGED', entityType: 'proyecto', entityId: id, proyectoId: id,
      detalles: { before: p.solvenciaEstado, after: input.estado, reason: input.motivo } });
    const after = await getProjectFinancialStatus(id, tx);
    if (before?.financialGateStatus !== after?.financialGateStatus) {
      await registrarEvento(tx, { actorId: actor.id, accion: 'FINANCIAL_GATE_CHANGED', entityType: 'proyecto', entityId: id, proyectoId: id,
        detalles: { before: before?.financialGateStatus, after: after?.financialGateStatus, reason: input.motivo } });
      await notifyGateChange(tx,p,before?.financialGateStatus,after?.financialGateStatus);
    }
    return after;
  });
}
