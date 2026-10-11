export interface PlazosServicio {
  codigo?: string;
  plazoDias: number | null;
  plazoInternoDias: number | null;
  plazoComercialDias: number | null;
}

// Regla operativa actual. Tripa 90 es provisional frente al Manual (150).
// El subtipo no modifica el peso del servicio.
export const PLAZOS_CRUDO = { Tripa: 90, 'Capítulo': 150 } as const;
export function esSubtipoCrudo(subtipo: string | null | undefined): subtipo is keyof typeof PLAZOS_CRUDO {
  return subtipo === 'Tripa' || subtipo === 'Capítulo';
}
export function resolverPlazosServicio(servicio: PlazosServicio, subtipo: string | null): PlazosServicio | null {
  if (servicio.codigo !== 'CR') return servicio;
  const dias = esSubtipoCrudo(subtipo) ? PLAZOS_CRUDO[subtipo] : null;
  return dias === null ? null : { ...servicio, plazoDias: dias, plazoInternoDias: null, plazoComercialDias: null };
}
export function nombreServicioProyecto(codigo: string, nombre: string, subtipo: string | null) {
  return codigo === 'CR' ? esSubtipoCrudo(subtipo) ? `Crudo ${subtipo}` : 'Crudo · pendiente de clasificación' : nombre;
}
export function proyectarIngreso(servicio: PlazosServicio, ficha: { ingresoFechaIngreso: string | null; ingresoServicioSubtipoCrudo: string | null }, fechaProgramada?: string): Cronograma | null {
  const plazo = resolverPlazosServicio(servicio, ficha.ingresoServicioSubtipoCrudo);
  const base = ficha.ingresoFechaIngreso ?? fechaProgramada;
  return plazo && base ? calcularCronograma(plazo, new Date(`${base}T00:00:00Z`)) : null;
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
