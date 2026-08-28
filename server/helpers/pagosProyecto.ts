import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, pagos, proyectos, servicios } from '../db/schema/index.js';

// Módulo financiero de Comercial. Nombre distinto de helpers/pagos.ts
// a propósito: ese archivo es el SSO del portal de pago externo (JWT de
// un solo uso para el autor), un concepto completamente aparte de este
// historial interno de pagos por proyecto — mismo nombre de dominio,
// responsabilidades sin relación.
export interface DatosNuevoPago {
  proyectoId: string;
  monto: string;
  moneda?: string;
  fechaPago: string;
  metodoPago: string;
  referencia?: string | null;
  comprobanteUrl?: string | null;
}

export async function registrarPago(datos: DatosNuevoPago) {
  const [fila] = await db.insert(pagos).values(datos).returning();
  if (!fila) throw new Error('El insert del pago no devolvió ninguna fila');
  return fila;
}

export interface PagoConProyecto {
  id: string;
  proyectoId: string;
  monto: string;
  moneda: string;
  fechaPago: string;
  metodoPago: string;
  referencia: string | null;
  comprobanteUrl: string | null;
  estatus: string;
  motivoRechazo: string | null;
  proyecto: {
    id: string;
    titulo: string | null;
    autorNombre: string;
    servicioCodigo: string;
  };
}

// Historial de pagos — ordenado por fecha de pago (no de creación del
// registro): dos pagos cargados el mismo día por alguien que se
// atrasó en la carga deben verse en el orden real en que se recibieron.
// proyectoId opcional filtra el historial de un solo proyecto (mismo
// endpoint que alimenta "Historial Reciente" en RegistrarPagoPage.tsx,
// con o sin proyecto seleccionado).
export async function listarPagos(proyectoId?: string): Promise<PagoConProyecto[]> {
  const filas = await db
    .select({
      id: pagos.id,
      proyectoId: pagos.proyectoId,
      monto: pagos.monto,
      moneda: pagos.moneda,
      fechaPago: pagos.fechaPago,
      metodoPago: pagos.metodoPago,
      referencia: pagos.referencia,
      comprobanteUrl: pagos.comprobanteUrl,
      estatus: pagos.estatus,
      motivoRechazo: pagos.motivoRechazo,
      proyectoTitulo: proyectos.titulo,
      autorNombre: autores.nombre,
      servicioCodigo: servicios.codigo,
    })
    .from(pagos)
    .innerJoin(proyectos, eq(pagos.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(proyectoId ? eq(pagos.proyectoId, proyectoId) : undefined)
    .orderBy(desc(pagos.fechaPago), desc(pagos.createdAt));

  return filas.map((fila) => ({
    id: fila.id,
    proyectoId: fila.proyectoId,
    monto: fila.monto,
    moneda: fila.moneda,
    fechaPago: fila.fechaPago,
    metodoPago: fila.metodoPago,
    referencia: fila.referencia,
    comprobanteUrl: fila.comprobanteUrl,
    estatus: fila.estatus,
    motivoRechazo: fila.motivoRechazo,
    proyecto: {
      id: fila.proyectoId,
      titulo: fila.proyectoTitulo,
      autorNombre: fila.autorNombre,
      servicioCodigo: fila.servicioCodigo,
    },
  }));
}

export type EstatusVerificacionPago = 'Verificado' | 'Rechazado';

export interface DatosVerificacionPago {
  estatus: EstatusVerificacionPago;
  motivoRechazo?: string | null;
}

// Único camino para pasar de 'Pendiente de verificación' a un estatus
// definitivo — cobranzas/jefe_area/dirección (ver pagos.routes.ts).
// motivoRechazo se limpia a null al aprobar (si un pago fue rechazado,
// corregido y reenviado, y esta vez se aprueba, no debe arrastrar el
// motivo del rechazo anterior).
export async function actualizarEstatusPago(pagoId: string, datos: DatosVerificacionPago) {
  const [fila] = await db
    .update(pagos)
    .set({
      estatus: datos.estatus,
      motivoRechazo: datos.estatus === 'Rechazado' ? (datos.motivoRechazo ?? null) : null,
    })
    .where(eq(pagos.id, pagoId))
    .returning();
  return fila;
}
