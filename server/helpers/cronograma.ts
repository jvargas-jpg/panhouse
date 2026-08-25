import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { proyectos, servicios } from '../db/schema/index.js';

export interface PlazosServicio {
  plazoDias: number | null;
  plazoInternoDias: number | null;
  plazoComercialDias: number | null;
}

export interface Cronograma {
  fechaInicio: Date;
  // Fecha visible/comprometida con el autor. Para servicios de plazo
  // único es la única fecha de fin; para SE es el compromiso comercial
  // (90 días), no la meta interna.
  fechaFinComprometida: Date;
  // Solo presente en servicios con plazo doble (SE): la meta interna
  // de gestión (60 días) que dispara alertas tempranas.
  fechaFinInterna: Date | null;
  // Calculado, nunca marcado a mano: la fecha deseada por el autor es
  // anterior a la que resulta del plazo estándar del servicio.
  esExpress: boolean;
}

function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

export function calcularCronograma(
  servicio: PlazosServicio,
  fechaInicio: Date,
  fechaDeseadaAutor?: Date | null,
): Cronograma {
  const esPlazoDoble = servicio.plazoComercialDias != null;

  if (esPlazoDoble) {
    if (servicio.plazoInternoDias == null) {
      throw new Error('Servicio con plazo comercial configurado pero sin plazo interno');
    }

    const fechaFinComprometida = sumarDias(fechaInicio, servicio.plazoComercialDias!);

    return {
      fechaInicio,
      fechaFinComprometida,
      fechaFinInterna: sumarDias(fechaInicio, servicio.plazoInternoDias),
      esExpress: fechaDeseadaAutor != null && fechaDeseadaAutor < fechaFinComprometida,
    };
  }

  if (servicio.plazoDias == null) {
    throw new Error('Servicio sin plazo configurado (falta plazoDias o el par plazoInterno/plazoComercial)');
  }

  const fechaFinComprometida = sumarDias(fechaInicio, servicio.plazoDias);

  return {
    fechaInicio,
    fechaFinComprometida,
    fechaFinInterna: null,
    esExpress: fechaDeseadaAutor != null && fechaDeseadaAutor < fechaFinComprometida,
  };
}

function parseFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export async function calcularCronogramaProyecto(proyectoId: string): Promise<Cronograma> {
  const [fila] = await db
    .select({
      fechaProgramadaInicio: proyectos.fechaProgramadaInicio,
      fechaDeseadaAutor: proyectos.fechaDeseadaAutor,
      plazoDias: servicios.plazoDias,
      plazoInternoDias: servicios.plazoInternoDias,
      plazoComercialDias: servicios.plazoComercialDias,
    })
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(eq(proyectos.id, proyectoId))
    .limit(1);

  if (!fila) {
    throw new Error(`Proyecto no encontrado: ${proyectoId}`);
  }

  return calcularCronograma(
    {
      plazoDias: fila.plazoDias,
      plazoInternoDias: fila.plazoInternoDias,
      plazoComercialDias: fila.plazoComercialDias,
    },
    parseFecha(fila.fechaProgramadaInicio),
    fila.fechaDeseadaAutor ? parseFecha(fila.fechaDeseadaAutor) : null,
  );
}
