import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import type { DecisionPortada } from '../db/schema/index.js';
import { fichasTrazabilidad, proyectos, servicios } from '../db/schema/index.js';
import { crearNotificacion, existeNotificacionNoLeida } from './notificaciones.js';

// Mensaje fijo (no interpolado con datos del proyecto): así
// existeNotificacionNoLeida puede compararlo por igualdad exacta para
// la guardia contra spam de abajo.
const MENSAJE_ENTREGA_MANUSCRITO = 'El autor ha entregado el enlace a su manuscrito original.';

// Portal del Autor: superficie deliberadamente angosta y aislada del
// resto de helpers/proyectos.ts (staff interno) — el pedido es
// explícito ("NO exponer campos de control de tiempos macro, IDs del
// escuadrón de producción, ni alertas de riesgo interno"), así que cada
// función de este archivo hace su propio SELECT explícito en vez de
// reusar alertas.ts/proyectos.ts, que sí traen esos campos por diseño
// para las pantallas internas.
export interface LibroAutor {
  id: string;
  titulo: string | null;
  estado: string;
  manuscritoUrl: string | null;
  servicio: { codigo: string; nombre: string };
  // Solo el estatus de texto de cada fase (para el badge "Fase Actual"
  // del frontend) — deliberadamente sin las fechas/días totales de cada
  // fase (esos sí son "control de tiempos macro", uso interno) ni los
  // ids de quién la tiene asignada ("escuadrón de producción").
  edicionEstatus: string | null;
  correccionEstatus: string | null;
  disenoEstatus: string | null;
  calidadEstatus: string | null;
  digitalEstatus: string | null;
  lanzamientoEstatus: string | null;
  impresionEstatus: string | null;
  distribucionEstatus: string | null;
  // Ciclo de aprobación de portada — el otro lado lo sube especialista/
  // disenador (PATCH /:id/propuesta-portada, helpers/proyectos.ts); el
  // autor lo aprueba/rechaza desde acá (actualizarDecisionPortada, más
  // abajo).
  propuestaPortadaUrl: string | null;
  portadaDecisionAutor: DecisionPortada;
  portadaFeedback: string | null;
}

const COLUMNAS_LIBRO_AUTOR = {
  id: proyectos.id,
  titulo: proyectos.titulo,
  estado: proyectos.estado,
  manuscritoUrl: proyectos.manuscritoUrl,
  servicioCodigo: servicios.codigo,
  servicioNombre: servicios.nombre,
  edicionEstatus: fichasTrazabilidad.edicionEstatus,
  correccionEstatus: fichasTrazabilidad.correccionEstatus,
  disenoEstatus: fichasTrazabilidad.disenoEstatus,
  calidadEstatus: fichasTrazabilidad.calidadEstatus,
  digitalEstatus: fichasTrazabilidad.digitalEstatus,
  lanzamientoEstatus: fichasTrazabilidad.lanzamientoEstatus,
  impresionEstatus: fichasTrazabilidad.impresionEstatus,
  distribucionEstatus: fichasTrazabilidad.distribucionEstatus,
  propuestaPortadaUrl: proyectos.propuestaPortadaUrl,
  portadaDecisionAutor: proyectos.portadaDecisionAutor,
  portadaFeedback: proyectos.portadaFeedback,
} as const;

function mapearFilaLibro(fila: {
  id: string;
  titulo: string | null;
  estado: string;
  manuscritoUrl: string | null;
  servicioCodigo: string;
  servicioNombre: string;
  edicionEstatus: string | null;
  correccionEstatus: string | null;
  disenoEstatus: string | null;
  calidadEstatus: string | null;
  digitalEstatus: string | null;
  lanzamientoEstatus: string | null;
  impresionEstatus: string | null;
  distribucionEstatus: string | null;
  propuestaPortadaUrl: string | null;
  portadaDecisionAutor: string;
  portadaFeedback: string | null;
}): LibroAutor {
  return {
    id: fila.id,
    titulo: fila.titulo,
    estado: fila.estado,
    manuscritoUrl: fila.manuscritoUrl,
    servicio: { codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
    edicionEstatus: fila.edicionEstatus,
    correccionEstatus: fila.correccionEstatus,
    disenoEstatus: fila.disenoEstatus,
    calidadEstatus: fila.calidadEstatus,
    digitalEstatus: fila.digitalEstatus,
    lanzamientoEstatus: fila.lanzamientoEstatus,
    impresionEstatus: fila.impresionEstatus,
    distribucionEstatus: fila.distribucionEstatus,
    propuestaPortadaUrl: fila.propuestaPortadaUrl,
    // portadaDecisionAutor es varchar en la base de datos (ver
    // server/db/schema/proyectos.ts), no un pgEnum — el cast se apoya en
    // que las únicas rutas de escritura (actualizarPropuestaPortada,
    // actualizarDecisionPortada) solo escriben valores de DECISIONES_PORTADA.
    portadaDecisionAutor: fila.portadaDecisionAutor as DecisionPortada,
    portadaFeedback: fila.portadaFeedback,
  };
}

// GET /proyectos/mis-libros — autorId ya viene resuelto desde la sesión
// (ver AuthenticatedUser.autorId en helpers/session.ts), así que esto
// nunca recibe un id que no sea el del propio autor logueado.
export async function listarMisLibros(autorId: string): Promise<LibroAutor[]> {
  const filas = await db
    .select(COLUMNAS_LIBRO_AUTOR)
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .innerJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id))
    .where(eq(proyectos.autorId, autorId))
    .orderBy(desc(proyectos.createdAt));

  return filas.map(mapearFilaLibro);
}

export type AccesoLibroAutor =
  | { ok: true }
  | { ok: false; status: 404; error: string }
  | { ok: false; status: 403; error: string };

// Chequeo de pertenencia para PATCH /:id/manuscrito: el proyecto debe
// ser de ESTE autor, no de cualquiera con sesión de rol 'autor' — sin
// esto, cualquier cuenta autor podría adivinar un uuid ajeno y pisar el
// manuscrito de otro libro.
export async function verificarAccesoLibroAutor(proyectoId: string, autorId: string): Promise<AccesoLibroAutor> {
  const [proyecto] = await db.select({ autorId: proyectos.autorId }).from(proyectos).where(eq(proyectos.id, proyectoId)).limit(1);
  if (!proyecto) {
    return { ok: false, status: 404, error: 'Proyecto no encontrado' };
  }
  if (proyecto.autorId !== autorId) {
    return { ok: false, status: 403, error: 'No autorizado para ver este proyecto' };
  }
  return { ok: true };
}

// Notifica a 'especialista' (responsable principal de operar el libro)
// cada vez que el autor entrega/actualiza el enlace — solo al ENTREGAR
// un enlace real, no al borrarlo (manuscritoUrl null no es una
// "entrega"), y solo si no hay ya una alerta sin leer idéntica (ver
// existeNotificacionNoLeida en helpers/notificaciones.ts), para no
// inundar la campana si el autor corrige la URL varias veces seguidas
// antes de que alguien la revise.
export async function actualizarManuscrito(proyectoId: string, manuscritoUrl: string | null) {
  const [fila] = await db.update(proyectos).set({ manuscritoUrl }).where(eq(proyectos.id, proyectoId)).returning();

  if (manuscritoUrl) {
    const yaNotificado = await existeNotificacionNoLeida({
      proyectoId,
      rolDestino: 'especialista',
      mensaje: MENSAJE_ENTREGA_MANUSCRITO,
    });
    if (!yaNotificado) {
      await crearNotificacion({ proyectoId, rolDestino: 'especialista', mensaje: MENSAJE_ENTREGA_MANUSCRITO });
    }
  }

  return fila;
}

// Guardián de negocio: rechazar una propuesta sin explicar por qué deja
// al especialista sin poder corregir nada — mismo criterio que
// validarPausaFormal en helpers/pausas.ts (la regla vive acá, en el
// helper, no solo en la forma del request), para que cualquier llamador
// futuro de actualizarDecisionPortada la respete, no solo la ruta HTTP.
export function validarDecisionPortada(decision: 'aprobada' | 'rechazada', feedback: string | null): void {
  if (decision === 'rechazada' && !feedback?.trim()) {
    throw new Error('El feedback es obligatorio al rechazar la propuesta de portada');
  }
}

// Decisión del autor sobre la propuesta de portada — el otro lado de
// actualizarPropuestaPortada (helpers/proyectos.ts, dueño especialista/
// disenador). Dispara una alerta a 'especialista', con la misma guardia
// contra spam que actualizarManuscrito de arriba: si el autor cambia de
// opinión varias veces seguidas antes de que alguien la lea, no se apila
// una notificación por cada cambio.
export async function actualizarDecisionPortada(proyectoId: string, decision: 'aprobada' | 'rechazada', feedback: string | null) {
  validarDecisionPortada(decision, feedback);

  const [fila] = await db
    .update(proyectos)
    .set({ portadaDecisionAutor: decision, portadaFeedback: feedback })
    .where(eq(proyectos.id, proyectoId))
    .returning();

  const mensaje = `El autor ha ${decision} la propuesta de portada.`;
  const yaNotificado = await existeNotificacionNoLeida({ proyectoId, rolDestino: 'especialista', mensaje });
  if (!yaNotificado) {
    await crearNotificacion({ proyectoId, rolDestino: 'especialista', mensaje });
  }

  return fila;
}
