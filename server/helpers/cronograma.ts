import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { proyectos, servicios, fichasTrazabilidad } from '../db/schema/index.js';

import { calcularCronograma, resolverPlazosServicio } from '../../shared/planificacion.js';
import type { Cronograma } from '../../shared/planificacion.js';
export { calcularCronograma, resolverPlazosServicio, proyectarIngreso } from '../../shared/planificacion.js';
export type { PlazosServicio, Cronograma } from '../../shared/planificacion.js';

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export async function calcularCronogramaProyecto(proyectoId: string): Promise<Cronograma> {
  const [fila] = await db
    .select({
      fechaProgramadaInicio: proyectos.fechaProgramadaInicio,
      fechaDeseadaAutor: proyectos.fechaDeseadaAutor,
      codigo: servicios.codigo,
      ingreso: fichasTrazabilidad.ingresoFechaIngreso,
      subtipo: fichasTrazabilidad.ingresoServicioSubtipoCrudo,
      deseadaFicha: fichasTrazabilidad.fechaDeseadaCulminacion,
      plazoDias: servicios.plazoDias,
      plazoInternoDias: servicios.plazoInternoDias,
      plazoComercialDias: servicios.plazoComercialDias,
    })
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .leftJoin(fichasTrazabilidad, eq(proyectos.id, fichasTrazabilidad.proyectoId))
    .where(eq(proyectos.id, proyectoId))
    .limit(1);

  if (!fila) {
    throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  }

  const plazo = resolverPlazosServicio(fila, fila.subtipo);
  if (!plazo) throw new Error('Crudo pendiente de clasificación por RRPP');
  const deseada = fila.deseadaFicha ?? fila.fechaDeseadaAutor;
  return calcularCronograma(plazo, parseFecha(fila.ingreso ?? fila.fechaProgramadaInicio), deseada ? parseFecha(deseada) : null);
}
