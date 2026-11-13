import { and, desc, eq, getTableColumns, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { notificaciones } from '../db/schema/index.js';

export interface DatosNuevaNotificacion {
  proyectoId?: string | null;
  rolDestino: string;
  usuarioDestinoId?: string | null;
  mensaje: string;
}
function validatorActionable(userId?: string) {
  if (!userId) return sql`false`;
  return sql`(exists (select 1 from ficha_calidad_fases q
    join project_assignments a on a.work_item_id=q.work_item_id and a.tipo='validador' and a.finalizado_en is null
    join diseno_versiones v on v.id=q.diseno_version_id and v.calidad_fase_id=q.id
    where a.usuario_id=${userId}::uuid and q.revisado_en is null
      and ${notificaciones.targetPath}='/?validacion='||q.id::text)
    or exists (select 1 from work_items w
      join project_assignments a on a.work_item_id=w.id and a.tipo='validador' and a.finalizado_en is null
      join diseno_versiones v on v.id::text=w.business_key
      join proyectos p on p.id=w.proyecto_id
      where w.tipo='validacion_cubierta' and w.estado in ('pendiente','en_progreso')
        and a.usuario_id=${userId}::uuid and v.feedback_en is null
        and p.estado not in ('pausado','stand_by','retirado','culminado')
        and not exists (select 1 from diseno_versiones newer where newer.diseno_id=v.diseno_id and newer.numero>v.numero)
        and ${notificaciones.targetPath}='/?validacion='||w.id::text))`;
}

// No la usa crearProyecto (server/helpers/proyectos.ts) — esa inserta
// directo con tx.insert(notificaciones) dentro de su propia transacción
// (mismo criterio que ya usa ahí con fichasTrazabilidad, para no pelear
// con el tipo de la transacción entre módulos). Esta queda para
// disparadores futuros que no necesiten esa atomicidad.
export async function crearNotificacion(datos: DatosNuevaNotificacion) {
  const [fila] = await db.insert(notificaciones).values(datos).returning();
  if (!fila) throw new Error('El insert de la notificación no devolvió ninguna fila');
  return fila;
}

// Más recientes primero — mismo criterio que el resto de los
// historiales de esta app (pagos, etc.): lo último que pasó es lo que
// alguien quiere ver arriba. usuarioId es opcional (retrocompatible con
// los call sites existentes que listaban por rol sin acotar a nadie):
// sin él, ve TODO lo de su rol, igual que antes de usuarioDestinoId.
// Con él, ve las notificaciones de su rol (broadcast, usuarioDestinoId
// null) MÁS las dirigidas puntualmente a su propio usuario — nunca las
// acotadas a otra persona del mismo rol.
export async function listarNotificacionesPorRol(rolDestino: string, usuarioId?: string) {
  const filtroRol = eq(notificaciones.rolDestino, rolDestino);
  const condicion = rolDestino === 'validador' ? and(filtroRol, usuarioId ? eq(notificaciones.usuarioDestinoId, usuarioId) : sql`false`, validatorActionable(usuarioId)) : usuarioId
    ? and(filtroRol, rolDestino === 'validador' ? eq(notificaciones.usuarioDestinoId, usuarioId) : or(isNull(notificaciones.usuarioDestinoId), eq(notificaciones.usuarioDestinoId, usuarioId)))
    : filtroRol;
  if(rolDestino==='jefe_edicion')return db.select({...getTableColumns(notificaciones),editorialRequestId:sql<string|null>`(
    SELECT wi.id FROM work_items wi JOIN proyectos p ON p.id=wi.proyecto_id
    WHERE wi.proyecto_id="notificaciones"."proyecto_id" AND wi.tipo='edicion' AND wi.business_key='default'
      AND p.editor_id IS NULL AND p.estado IN ('en_proceso','retrasado') AND wi.estado IN ('pendiente','en_progreso') AND wi.gate_bloqueante IS NULL
      AND EXISTS(SELECT 1 FROM audit_logs a WHERE a.entity_id=wi.id AND a.accion='EDITOR_SOLICITADO')
      AND NOT EXISTS(SELECT 1 FROM solicitudes_area r WHERE r.work_item_id=wi.id AND r.tipo='editor' AND r.estado<>'pendiente')
    LIMIT 1)`}).from(notificaciones).where(condicion).orderBy(desc(notificaciones.createdAt));
  return db.select().from(notificaciones).where(condicion).orderBy(desc(notificaciones.createdAt));
}

// Guardia contra spam: usado por disparadores que pueden repetirse
// varias veces seguidas para el mismo proyecto (ej. el autor corrige el
// enlace de su manuscrito antes de que alguien lo revise) — si ya hay
// una alerta sin leer con el mismo mensaje, no tiene sentido apilar otra
// idéntica en la campana del destinatario.
export async function existeNotificacionNoLeida(datos: { proyectoId: string; rolDestino: string; mensaje: string }): Promise<boolean> {
  const [fila] = await db
    .select({ id: notificaciones.id })
    .from(notificaciones)
    .where(
      and(
        eq(notificaciones.proyectoId, datos.proyectoId),
        eq(notificaciones.rolDestino, datos.rolDestino),
        eq(notificaciones.mensaje, datos.mensaje),
        eq(notificaciones.leido, false),
      ),
    )
    .limit(1);
  return Boolean(fila);
}

// El where compuesto hace de chequeo de pertenencia: si la notificación
// existe pero es de otro rol, o está acotada a otro usuario del mismo
// rol, esto no actualiza nada y devuelve undefined — la ruta lo
// traduce a 404 en vez de filtrar si el id existe para alguien ajeno.
// usuarioId opcional, mismo criterio retrocompatible que
// listarNotificacionesPorRol.
export async function marcarNotificacionLeida(id: string, rolDestino: string, usuarioId?: string) {
  const condicionBase = and(eq(notificaciones.id, id), eq(notificaciones.rolDestino, rolDestino));
  const condicion = rolDestino === 'validador' ? and(condicionBase, usuarioId ? eq(notificaciones.usuarioDestinoId, usuarioId) : sql`false`, validatorActionable(usuarioId)) : usuarioId
    ? and(condicionBase, rolDestino === 'validador' ? eq(notificaciones.usuarioDestinoId, usuarioId) : or(isNull(notificaciones.usuarioDestinoId), eq(notificaciones.usuarioDestinoId, usuarioId)))
    : condicionBase;
  const [fila] = await db.update(notificaciones).set({ leido: true }).where(condicion).returning();
  return fila;
}
