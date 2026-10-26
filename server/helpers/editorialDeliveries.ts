import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { capitulos, editorialBlockers, editorialDeliveries, proyectos, workItems } from '../db/schema/index.js';
import { actualizarCapituloEditor } from './capitulos.js';
import { transicionarWorkItemPorId } from './workItems.js';
import { registrarEvento } from './auditLog.js';
import { obtenerEspecialistaActual } from './carga.js';
import { notificaciones } from '../db/schema/index.js';
import { diaCaracas } from './atencionEspecialista.js';

// El id de un archivo de Drive en una URL de compartir puede venir en
// varias formas (/file/d/<id>/, /folders/<id>, ?id=<id>, open?id=<id>).
// Mejor esfuerzo: si no calza con ningún patrón conocido, driveFileId
// queda null -- nunca se bloquea la entrega por esto (prompt §51: el
// archivo es el dato real, el id es solo metadata derivada).
function extraerDriveFileId(url: string): string | null {
  const patterns = [/\/file\/d\/([\w-]{10,})/, /\/folders\/([\w-]{10,})/, /[?&]id=([\w-]{10,})/];
  for (const p of patterns) { const m = url.match(p); if (m?.[1]) return m[1]; }
  return null;
}

async function bloqueoAbierto(workItemId: string) {
  const [b] = await db.select({ id: editorialBlockers.id }).from(editorialBlockers).where(and(eq(editorialBlockers.workItemId, workItemId), isNull(editorialBlockers.resolvedAt)));
  return !!b;
}

// Ventana de idempotencia (prompt §151): un doble click ocurre en
// milisegundos; una reentrega real tras feedback aplicado ocurre horas o
// días después. Un bloqueo FOR UPDATE sobre el work item serializa las dos
// llamadas concurrentes; la segunda, ya serializada, encuentra la entrega
// recién insertada por la primera dentro de la ventana y la reutiliza en
// vez de crear una fila nueva.
const VENTANA_DOBLE_CLICK_MS = 5000;

// "Registrar entrega" (prompt Editor §50-54): a diferencia del PATCH
// anterior (solo fecha), ahora persiste la referencia real al archivo
// (editorial_deliveries, mismo patrón metadata-only que creative_deliveries)
// Y avanza el work item -- capítulos reusan actualizarCapituloEditor tal
// cual (ya resuelve feedback cycle / notificación / auditoría); el resto
// usa la transición genérica.
export async function registrarEntregaEditorial(workItemId: string, driveUrl: string, actorId: string, observaciones?: string) {
  const [item] = await db.select({ id: workItems.id, proyectoId: workItems.proyectoId, businessKey: workItems.businessKey, tipo: workItems.tipo }).from(workItems).where(eq(workItems.id, workItemId));
  if (!item) throw Object.assign(new Error('Intervención no encontrada'), { statusCode: 404 });
  const [proyecto] = await db.select({ editorId: proyectos.editorId }).from(proyectos).where(eq(proyectos.id, item.proyectoId));
  if (proyecto?.editorId !== actorId) throw Object.assign(new Error('Esta intervención no está asignada a este Editor'), { statusCode: 403 });
  if (await bloqueoAbierto(workItemId)) throw Object.assign(new Error('Esta intervención tiene un bloqueo abierto. Resuélvelo antes de entregar.'), { statusCode: 409 });

  const driveFileId = extraerDriveFileId(driveUrl);
  const delivery = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'entrega:' + workItemId}, 0))`);
    const umbral = new Date(Date.now() - VENTANA_DOBLE_CLICK_MS);
    const [reciente] = await tx.select().from(editorialDeliveries)
      .where(and(eq(editorialDeliveries.workItemId, workItemId), eq(editorialDeliveries.driveUrl, driveUrl), gte(editorialDeliveries.submittedAt, umbral)))
      .orderBy(desc(editorialDeliveries.submittedAt)).limit(1);
    if (reciente) return reciente;
    const [nueva] = await tx.insert(editorialDeliveries).values({ projectId: item.proyectoId, workItemId, driveUrl, driveFileId, observaciones, submittedBy: actorId }).returning();
    return nueva!;
  });

  if (item.businessKey.startsWith('capitulo:')) {
    const capituloId = item.businessKey.slice('capitulo:'.length);
    const [c] = await db.select({ numero: capitulos.numero }).from(capitulos).where(eq(capitulos.id, capituloId));
    if (!c) throw Object.assign(new Error('Capítulo no encontrado'), { statusCode: 404 });
    await actualizarCapituloEditor(item.proyectoId, c.numero, { fechaEntregaEditor: diaCaracas(new Date()) }, actorId);
  } else {
    await db.transaction(async tx => {
      await transicionarWorkItemPorId(tx, workItemId, 'completado');
      await registrarEvento(tx, { actorId, accion: 'EDITOR_ENTREGA_REGISTRADA', entityType: 'work_item', entityId: workItemId, proyectoId: item.proyectoId, detalles: { driveUrl } });
      const especialistaId = await obtenerEspecialistaActual(item.proyectoId, null, tx);
      if (especialistaId) await tx.insert(notificaciones).values({ proyectoId: item.proyectoId, rolDestino: 'especialista', usuarioDestinoId: especialistaId, mensaje: 'El Editor entregó una nueva versión.' });
    });
  }
  return delivery!;
}

export async function listarEntregasEditoriales(workItemId: string, actor: { id: string; rol: string }) {
  const [item] = await db.select({ id: workItems.id, proyectoId: workItems.proyectoId }).from(workItems).where(eq(workItems.id, workItemId));
  if (!item) throw Object.assign(new Error('Intervención no encontrada'), { statusCode: 404 });
  if (actor.rol === 'editor') {
    const [proyecto] = await db.select({ editorId: proyectos.editorId }).from(proyectos).where(eq(proyectos.id, item.proyectoId));
    if (proyecto?.editorId !== actor.id) throw Object.assign(new Error('Esta intervención no está asignada a este Editor'), { statusCode: 403 });
  }
  return db.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId, workItemId)).orderBy(desc(editorialDeliveries.submittedAt));
}

// "Iniciar trabajo" genérico (prompt §157) para intervenciones que NO son
// capítulo -- los capítulos ya tienen su propio PATCH existente
// (fechaInicioEditor vía /capitulos/:proyectoId/:numero/editor).
export async function iniciarTrabajoEditorial(workItemId: string, actorId: string) {
  const [item] = await db.select({ id: workItems.id, proyectoId: workItems.proyectoId, businessKey: workItems.businessKey }).from(workItems).where(eq(workItems.id, workItemId));
  if (!item) throw Object.assign(new Error('Intervención no encontrada'), { statusCode: 404 });
  if (item.businessKey.startsWith('capitulo:')) throw Object.assign(new Error('Usa el registro de inicio de capítulo'), { statusCode: 409 });
  const [proyecto] = await db.select({ editorId: proyectos.editorId }).from(proyectos).where(eq(proyectos.id, item.proyectoId));
  if (proyecto?.editorId !== actorId) throw Object.assign(new Error('Esta intervención no está asignada a este Editor'), { statusCode: 403 });
  if (await bloqueoAbierto(workItemId)) throw Object.assign(new Error('Esta intervención tiene un bloqueo abierto. Resuélvelo antes de iniciar.'), { statusCode: 409 });
  await db.transaction(async tx => {
    await transicionarWorkItemPorId(tx, workItemId, 'en_progreso');
    await registrarEvento(tx, { actorId, accion: 'EDITOR_TRABAJO_INICIADO', entityType: 'work_item', entityId: workItemId, proyectoId: item.proyectoId });
  });
}
