import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pausas } from '../db/schema/index.js';
import type { CausaPausa, OrigenConfirmacionPago } from '../db/schema/index.js';
import type { RangoPausa } from './performance.js';
import { calcularDuracionEfectivaDias } from './performance.js';

export interface DatosNuevaPausa {
  proyectoId: string;
  causa: CausaPausa;
  fechaInicio: Date;
  fechaFin?: Date | null;
  esPausadoFormal?: boolean;
  fechaLimiteRetoma?: string | null;
  recargoAplica?: boolean;
  pagoConfirmado?: boolean;
  origenConfirmacionPago?: OrigenConfirmacionPago | null;
  confirmadoPagoPorId?: string | null;
  confirmadoPagoEn?: Date | null;
}

// Guardián único reutilizado por cualquier punto de entrada que escriba
// pausas (hoy `crearPausa`; mañana también la ruta HTTP y una eventual
// edición): PAUSADO exige el proyecto pagado en su totalidad, así que
// es imposible persistir esPausadoFormal=true con pagoConfirmado=false.
export function validarPausaFormal(datos: Pick<DatosNuevaPausa, 'esPausadoFormal' | 'pagoConfirmado'>): void {
  if (datos.esPausadoFormal && !datos.pagoConfirmado) {
    throw new Error(
      'No se puede registrar una pausa formal (PAUSADO) sin confirmar que el proyecto está pagado en su totalidad',
    );
  }
}

export async function crearPausa(datos: DatosNuevaPausa) {
  validarPausaFormal(datos);

  const [fila] = await db.insert(pausas).values(datos).returning();
  if (!fila) throw new Error('El insert de la pausa no devolvió ninguna fila');
  return fila;
}

// Toda fila de `pausas` es, por construcción del esquema, de causa
// autor u otro departamento (ver server/db/schema/pausas.ts), así que
// no hace falta filtrar por causa aquí: cada pausa registrada del
// proyecto debe excluirse del tiempo efectivo transcurrido.
export async function obtenerPausasProyecto(proyectoId: string): Promise<RangoPausa[]> {
  const filas = await db
    .select({ fechaInicio: pausas.fechaInicio, fechaFin: pausas.fechaFin })
    .from(pausas)
    .where(eq(pausas.proyectoId, proyectoId));

  return filas.map((fila) => ({ fechaInicio: fila.fechaInicio, fechaFin: fila.fechaFin }));
}

// Para la pantalla de detalle: la fila completa (causa, fechas, datos
// de la pausa formal si aplica), no solo las dos columnas que necesita
// el cálculo de días efectivos — ver obtenerPausasProyecto arriba, que
// no se toca porque calcularDiasEfectivosProyecto depende de esa forma
// exacta.
export async function listarPausasProyecto(proyectoId: string) {
  return db.select().from(pausas).where(eq(pausas.proyectoId, proyectoId)).orderBy(pausas.fechaInicio);
}

// Punto único reutilizado por KPIs, alertas y desempeño para calcular
// cuántos días efectivos ha corrido un proyecto: obtiene su historial
// de pausas y delega la exclusión en calcularDuracionEfectivaDias.
export async function calcularDiasEfectivosProyecto(
  proyectoId: string,
  fechaInicio: Date,
  fechaFin: Date,
  ahora: Date = new Date(),
): Promise<number> {
  const historialPausas = await obtenerPausasProyecto(proyectoId);
  return calcularDuracionEfectivaDias(fechaInicio, fechaFin, historialPausas, ahora);
}
