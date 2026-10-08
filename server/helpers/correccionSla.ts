export const ALCANCES_CORRECCION = ['tripa_completa', 'preliminares', 'cubierta_extendida'] as const;

export type AlcanceCorreccion = (typeof ALCANCES_CORRECCION)[number];

// Horas CONTINUAS (no hábiles) por alcance — confirmadas cruzando la
// columna real "Máximo días"/"Tiempo Correcto" de la Matriz
// (Seguimiento Corrección - Innovación Editorial) contra el Manual del
// Especialista §3.1 ("Plazo de entrega: 5 días continuos", que aplica
// exactamente a TRIPA COMPLETA — coincide con el valor real de la
// columna). Horas, no días, a propósito (checkpoint 5B §0.1): Preliminares
// y Cubierta Extendida corren en ~0.5 día real en la Matriz
// (0.125/0.3/0.5 días observados) — redondear eso a 1 día de calendario
// perdía la mitad del plazo real. 1 día continuo = 24h exactas, 5 días
// continuos = 120h exactas; 0.5 día = 12h exactas, sin redondeo.
const HORAS_CONTINUAS_POR_ALCANCE: Record<AlcanceCorreccion, number> = {
  tripa_completa: 120,
  preliminares: 12,
  cubierta_extendida: 12,
};

// Manual del Especialista — actualización "Proceso de Corrección -
// Equipo Freelance": "toda tripa que exceda las 120 páginas en Word
// deberá ser revisada previamente antes de su asignación a corrección.
// En estos casos, el costo será mayor... previa evaluación del proyecto
// y análisis particular." El costo NO está definido con una fórmula —
// esta ronda no lo calcula, solo marca la necesidad de revisión previa
// (ver GATE-06 en server/helpers/gates.ts).
export const UMBRAL_PAGINAS_REVISION_PREVIA = 120;

export function requiereRevisionPreviaPorPaginas(paginas: number | null | undefined): boolean {
  return typeof paginas === 'number' && paginas > UMBRAL_PAGINAS_REVISION_PREVIA;
}

// Suma horas exactas sobre un INSTANTE completo (no una fecha sin hora)
// — a diferencia de sumarDiasHabiles (edicionSla.ts), Corrección corre
// en tiempo continuo: el Manual lo dice explícitamente ("5 días
// continuos") y los datos reales de la Matriz confirman entregas en
// fin de semana. `correcciones.dueAt` es timestamp (no date, ver
// server/db/schema/correcciones.ts) precisamente para poder cargar esta
// precisión sin redondear.
export function sumarHorasContinuas(instanteIso: string, horas: number): string {
  const instante = new Date(instanteIso);
  return new Date(instante.getTime() + horas * 60 * 60 * 1000).toISOString();
}

// `instanteAsignacion`: el momento REAL de la asignación formal
// (new Date().toISOString(), no solo la fecha) — una base de medio día
// sin hora sería ambigua para un SLA de 12h. correcciones.fechaAsignada
// (columna `date`, el día que ve la UI) es independiente de este cálculo.
export function calcularDueAtCorreccion(instanteAsignacion: string, alcance: AlcanceCorreccion): string {
  return sumarHorasContinuas(instanteAsignacion, HORAS_CONTINUAS_POR_ALCANCE[alcance]);
}

// "En tiempo" / "vencido" / "próximo a vencer" — se deriva, nunca se
// guarda (mismo criterio que evaluarRiesgoProyecto en alertas.ts).
export type EstadoPlazoCorreccion = 'en_tiempo' | 'proximo_a_vencer' | 'vencido';

const UMBRAL_PROXIMO_A_VENCER_HORAS = 24;

// Nuevas entregas: comparar instantes exactos. Históricos sin hora conservan
// su comparación por día; nunca se inventa la hora de un DATE legacy.
export function evaluarPlazoCorreccion(
  dueAt: string | Date | null,
  fechaEntrega: string | null,
  ahora: Date = new Date(),
  entregadoEn: string | Date | null = null,
): EstadoPlazoCorreccion | null {
  if (!dueAt) return null;
  const limite = new Date(dueAt);

  if (entregadoEn) {
    return new Date(entregadoEn).getTime() > limite.getTime() ? 'vencido' : 'en_tiempo';
  }

  if (fechaEntrega) {
    const diaLimite = limite.toISOString().slice(0, 10);
    return fechaEntrega > diaLimite ? 'vencido' : 'en_tiempo';
  }

  if (ahora.getTime() > limite.getTime()) return 'vencido';

  const horasRestantes = (limite.getTime() - ahora.getTime()) / (1000 * 60 * 60);
  if (horasRestantes <= UMBRAL_PROXIMO_A_VENCER_HORAS) return 'proximo_a_vencer';
  return 'en_tiempo';
}
