export const ALCANCES_CORRECCION = ['tripa_completa', 'preliminares', 'cubierta_extendida'] as const;

export type AlcanceCorreccion = (typeof ALCANCES_CORRECCION)[number];

// Días CONTINUOS (no hábiles) por alcance — confirmados cruzando la
// columna real "Máximo días"/"Tiempo Correcto" de la Matriz
// (Seguimiento Corrección - Innovación Editorial) contra el Manual del
// Especialista §3.1 ("Plazo de entrega: 5 días continuos", que aplica
// exactamente a TRIPA COMPLETA — coincide con el valor real de la
// columna, no hay contradicción). Preliminares y Cubierta Extendida
// corren casi siempre el mismo día en la Matriz (0.125/0.3/0.5 días
// reales observados) — se redondean hacia arriba a 1 día de calendario
// porque esta tabla no tiene granularidad de horas; ver sumarDiasContinuos.
const DIAS_CONTINUOS_POR_ALCANCE: Record<AlcanceCorreccion, number> = {
  tripa_completa: 5,
  preliminares: 0.5,
  cubierta_extendida: 0.5,
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

// A diferencia de sumarDiasHabiles (edicionSla.ts), Corrección corre en
// días CONTINUOS — el Manual lo dice explícitamente ("5 días
// continuos") y los datos reales de la Matriz confirman entregas en
// fin de semana. Sin granularidad de horas en este schema, los alcances
// de medio día (0.5) se redondean hacia arriba a 1 día de calendario —
// decisión de traducción documentada acá, no un cambio silencioso del
// SLA real.
export function sumarDiasContinuos(fechaIso: string, diasContinuos: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + Math.ceil(diasContinuos));
  return fecha.toISOString().slice(0, 10);
}

export function calcularDueAtCorreccion(fechaAsignada: string, alcance: AlcanceCorreccion): string {
  return sumarDiasContinuos(fechaAsignada, DIAS_CONTINUOS_POR_ALCANCE[alcance]);
}

// "En tiempo" / "vencido" / "próximo a vencer" — se deriva, nunca se
// guarda (mismo criterio que evaluarRiesgoProyecto en alertas.ts).
export type EstadoPlazoCorreccion = 'en_tiempo' | 'proximo_a_vencer' | 'vencido';

const UMBRAL_PROXIMO_A_VENCER_DIAS = 1;

export function evaluarPlazoCorreccion(dueAt: string | null, fechaEntrega: string | null, ahora: Date = new Date()): EstadoPlazoCorreccion | null {
  if (!dueAt) return null;
  const limite = new Date(`${dueAt}T23:59:59.999Z`);
  const referencia = fechaEntrega ? new Date(`${fechaEntrega}T00:00:00.000Z`) : ahora;

  if (referencia.getTime() > limite.getTime()) return 'vencido';

  const diasRestantes = (limite.getTime() - referencia.getTime()) / (1000 * 60 * 60 * 24);
  if (!fechaEntrega && diasRestantes <= UMBRAL_PROXIMO_A_VENCER_DIAS) return 'proximo_a_vencer';
  return 'en_tiempo';
}
