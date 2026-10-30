import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, pagos, proyectos, servicios } from '../db/schema/index.js';

// Módulo financiero de Comercial. Nombre distinto de helpers/pagos.ts
// a propósito: ese archivo es el SSO del portal de pago externo (JWT de
// un solo uso para el autor), un concepto completamente aparte de este
// historial interno de pagos por proyecto — mismo nombre de dominio,
// responsabilidades sin relación.


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
export async function listarPagos(proyectoId?: string, page = 1): Promise<PagoConProyecto[]> {
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
    .orderBy(desc(pagos.fechaPago), desc(pagos.createdAt), desc(pagos.id)).limit(100).offset((page - 1) * 100);

  return filas.map((fila) => ({
    id: fila.id,
    proyectoId: fila.proyectoId,
    monto: fila.monto,
    moneda: fila.moneda,
    fechaPago: fila.fechaPago,
    metodoPago: fila.metodoPago,
    referencia: fila.referencia,
    comprobanteUrl: fila.comprobanteUrl ? '/api/pagos/'+fila.id+'/comprobante' : null,
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
