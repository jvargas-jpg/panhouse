import { createHash } from 'node:crypto';
import { assertFinancialGate } from './estadoFinanciero.js';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { auditLogs, fichaDocumentalDatos, fichasTrazabilidad, notificaciones, proyectos, workItems } from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { diaCaracas } from './atencionEspecialista.js';
import { obtenerEspecialistaActual } from './carga.js';
import { DIGITAL_WORK_ROWS_SQL, type DigitalWorkItemRow } from './soporteDigitalHome.js';
import { canEditDigitalData, digitalRevision, digitalWorkError, nextDigitalAction } from './soporteDigitalWork.js';
import { CAMPOS_DOCUMENTALES } from './fichaDocumentalCatalogo.js';
import type { DigitalWorkAction } from '../../shared/soporteDigitalWork.js';

// Sin estados Amazon nuevos: registra exclusivamente hitos ya existentes.
// El lock del proyecto también serializa las escrituras de la ficha y Diseño.
export async function registrarAccionDigital(workItemId: string, input: DigitalWorkAction, actor: { id: string; rol: string }) {
  if (actor.rol !== 'soporte_digital') throw digitalWorkError('Acción no autorizada', 403);
  return db.transaction(async tx => {
    const [origin] = await tx.select().from(workItems).where(eq(workItems.id, workItemId));
    if (!origin || origin.tipo !== 'soporte_digital') throw digitalWorkError('Tarea digital no encontrada');
    await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, origin.proyectoId)).for('update');
    await tx.select({ id: workItems.id }).from(workItems).where(eq(workItems.id, workItemId)).for('update');
    const result = await tx.execute(sql`${sql.raw(DIGITAL_WORK_ROWS_SQL)} WHERE w.id=${workItemId}`);
    const r = result.rows[0] as DigitalWorkItemRow | undefined;
    if (!r) throw digitalWorkError('Tarea digital no encontrada');
    const fingerprint = createHash('sha256').update(JSON.stringify({ kind: input.kind, date: input.date ?? null, dateKindle: input.dateKindle ?? null,
      datos: input.datos ? Object.fromEntries(Object.entries(input.datos).sort(([a], [b]) => a.localeCompare(b))) : null,
    })).digest('hex');
    const [previous] = await tx.select({ detalles: auditLogs.detalles }).from(auditLogs).where(and(
      eq(auditLogs.entityType, 'work_item'), eq(auditLogs.entityId, workItemId), eq(auditLogs.actorId, actor.id),
      sql`${auditLogs.detalles}->>'requestId'=${input.requestId}`,
    )).limit(1);
    if (previous) {
      if ((previous.detalles as { fingerprint?: string } | null)?.fingerprint !== fingerprint) throw digitalWorkError('El identificador de la operación ya se utilizó con otros datos', 409);
      return { ok: true, replayed: true };
    }
    if (input.expectedRevision !== digitalRevision(r)) throw digitalWorkError('La tarea cambió en otra sesión. Actualiza el detalle antes de continuar.', 409);
    const next = nextDigitalAction(r);
    const canStart = !!next && r.estado === 'pendiente' && !r.activation && !r.started_at;
    // KDP y Kindle son hitos independientes del catálogo: una carga no
    // impide registrar después el otro formato antes del cierre interno.
    const canLoad = canEditDigitalData(r) && !!r.activation && r.package_available && r.tested
      && (!input.date || !r.loaded_kdp) && (!input.dateKindle || !r.loaded_kindle);
    const allowed = input.kind === 'actualizarDatos' ? canEditDigitalData(r) : input.kind === 'iniciarTarea' ? canStart
      : input.kind === 'registrarCarga' ? canLoad : next?.kind === input.kind;
    if (!allowed) throw digitalWorkError('Esta acción ya no está disponible para la tarea', 409);
    const today = diaCaracas(new Date());
    if ([input.date, input.dateKindle].some(d => d && d > today)) throw digitalWorkError('La fecha de un hito realizado no puede estar en el futuro', 400);
    const projectId = r.proyecto_id;
    if (['registrarActivacion','registrarCarga','marcarCompletado'].includes(input.kind)) await assertFinancialGate(tx, projectId);
    const date = input.date!;
    if (input.kind !== 'iniciarTarea' && !r.control_updated_at) throw digitalWorkError('El proyecto todavía no tiene ficha digital', 409);
    let campos: string[] = [];
    if (input.kind === 'iniciarTarea') {
      await tx.update(workItems).set({ estado: 'en_progreso', fechaInicioReal: today }).where(eq(workItems.id, workItemId));
    } else if (input.kind === 'enviarFormulario') {
      await tx.update(fichasTrazabilidad).set({ soporteDigitalFechaEnvioFormulario: date }).where(eq(fichasTrazabilidad.proyectoId, projectId));
      campos = ['soporteDigitalFechaEnvioFormulario'];
    } else if (input.kind === 'registrarActivacion') {
      await tx.update(fichasTrazabilidad).set({ soporteDigitalFechaActivacion: date }).where(eq(fichasTrazabilidad.proyectoId, projectId));
      await tx.update(workItems).set({ estado: 'completado', fechaFinReal: date }).where(eq(workItems.id, workItemId));
      campos = ['soporteDigitalFechaActivacion'];
    } else if (input.kind === 'marcarCompletado') {
      await tx.update(fichasTrazabilidad).set({ digitalEstatus: 'Completado', digitalFechaEntrega: date }).where(eq(fichasTrazabilidad.proyectoId, projectId));
      campos = ['digitalEstatus', 'digitalFechaEntrega'];
    } else {
      // nextDigitalAction revalida paquete final + activación + prueba previa
      // bajo el mismo lock. Las dos cargas se guardan en una sola transacción.
      const patch: Record<string, string | null> = input.kind === 'actualizarDatos' ? input.datos! : input.kind === 'registrarPrueba' ? { pruebaArchivos: date } : {
        ...(input.date ? { cargaKdp: input.date } : {}), ...(input.dateKindle ? { cargaKindle: input.dateKindle } : {}),
      };
      if (input.kind === 'actualizarDatos') for (const [key, value] of Object.entries(patch)) {
        const field = CAMPOS_DOCUMENTALES.find(f => f.area === 'digital' && f.key === key && f.roles.includes('soporte_digital'));
        if (!field || ['pruebaArchivos', 'cargaKdp', 'cargaKindle'].includes(key)) throw digitalWorkError('Este dato requiere su acción específica o pertenece a otra área', 400);
        if (value == null) continue;
        if (field.type === 'fecha' && !z.string().date().safeParse(value).success) throw digitalWorkError('Fecha inválida', 400);
        if (field.type === 'enlace') {
          try { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error(); }
          catch { throw digitalWorkError('Usa un enlace HTTP o HTTPS sin credenciales', 400); }
        }
      }
      const [before] = await tx.select().from(fichaDocumentalDatos).where(and(eq(fichaDocumentalDatos.proyectoId, projectId), eq(fichaDocumentalDatos.seccion, 'digital')));
      const datos = { ...before?.datos, ...patch };
      await tx.insert(fichaDocumentalDatos).values({ proyectoId: projectId, seccion: 'digital', datos }).onConflictDoUpdate({
        target: [fichaDocumentalDatos.proyectoId, fichaDocumentalDatos.seccion], set: { datos, updatedAt: new Date() },
      });
      campos = Object.keys(patch);
    }
    await registrarEvento(tx, {
      actorId: actor.id, accion: input.kind === 'iniciarTarea' ? 'DIGITAL_TRABAJO_INICIADO'
        : input.kind === 'registrarActivacion' ? 'AMAZON_ACTIVACION_REGISTRADA'
        : input.kind === 'marcarCompletado' ? 'DIGITAL_CONTROL_COMPLETADO' : input.kind === 'actualizarDatos' ? 'DIGITAL_DATOS_ACTUALIZADOS' : 'DIGITAL_HITO_REGISTRADO',
      entityType: 'work_item', entityId: workItemId, proyectoId: projectId,
      detalles: { kind: input.kind, campos, date: input.date ?? null, dateKindle: input.dateKindle ?? null, requestId: input.requestId, fingerprint,
        ...(['registrarPrueba', 'registrarCarga'].includes(input.kind) ? { materialRevision: r.material_revision } : {}),
      },
    });
    if (input.kind === 'registrarActivacion' || input.kind === 'marcarCompletado') {
      const [p] = await tx.select({ especialistaId: proyectos.especialistaId }).from(proyectos).where(eq(proyectos.id, projectId));
      const specialist = await obtenerEspecialistaActual(projectId, p?.especialistaId ?? null, tx);
      if (specialist) await tx.insert(notificaciones).values({ proyectoId: projectId, rolDestino: 'especialista', usuarioDestinoId: specialist,
        mensaje: input.kind === 'registrarActivacion' ? 'Soporte Digital registró la activación Amazon.' : 'Soporte Digital completó el control digital.',
        targetPath: '/proyectos/' + projectId,
      });
    }
    return { ok: true, replayed: false };
  });
}
