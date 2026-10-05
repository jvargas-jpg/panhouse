import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { notificaciones } from '../db/schema/index.js';

export interface DatosNuevaNotificacion {
  proyectoId?: string | null;
  rolDestino: string;
  usuarioDestinoId?: string | null;
  mensaje: string;
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
  const condicion = usuarioId
    ? and(filtroRol, or(isNull(notificaciones.usuarioDestinoId), eq(notificaciones.usuarioDestinoId, usuarioId)))
    : filtroRol;
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
  const condicion = usuarioId
    ? and(condicionBase, or(isNull(notificaciones.usuarioDestinoId), eq(notificaciones.usuarioDestinoId, usuarioId)))
    : condicionBase;
  const [fila] = await db.update(notificaciones).set({ leido: true }).where(condicion).returning();
  return fila;
}
