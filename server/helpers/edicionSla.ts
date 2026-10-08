// Plazos del subpipeline de Edición — fuente: Proceso de adiestramiento
// - Especialista editorial (3).docx, §2.3 ("Para el caso de EEC/EF: El
// editor tendrá 3 días hábiles... el autor tiene 3 días hábiles para
// feedback"; "tripa completa... el autor tiene 5 días para feedback").
// Centralizado acá a propósito — "No hardcodear esto en React. Usar
// dominio/configuración adecuada" (master prompt Fase 5 §36). Mismos
// valores para los tres servicios con edición (EF/EEC/EET vía CR) — el
// Manual no distingue plazos de edición por subtipo, a diferencia del
// SLA de cierre del proyecto (ver GATE-02 y la contradicción documental
// en docs/arquitectura/12-fase5-auditoria-diferencial.md §5).
export const DIAS_HABILES_EDICION_CAPITULO = 3;
export const DIAS_HABILES_FEEDBACK_AUTOR_CAPITULO = 3;
export const DIAS_HABILES_FEEDBACK_AUTOR_TRIPA = 5;

function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getUTCDay();
  return dia === 0 || dia === 6;
}

// Suma días HÁBILES (lunes a viernes, sin feriados — el Manual no
// documenta un calendario de feriados propio, así que no se inventa
// uno) a una fecha ISO 'YYYY-MM-DD'. Devuelve otra fecha ISO.
export function sumarDiasHabiles(fechaIso: string, diasHabiles: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  let restantes = diasHabiles;
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    if (!esFinDeSemana(fecha)) restantes -= 1;
  }
  return fecha.toISOString().slice(0, 10);
}

// Fecha pautada de feedback del autor para UN capítulo — se usa como
// default cuando se registra fechaEnvioAutor sin que el especialista
// haya fijado ya una fechaPautadaFeedback explícita a mano (ver
// actualizarCapituloAutor en server/helpers/capitulos.ts). Nunca
// sobreescribe un valor ya puesto a mano.
export function calcularFechaPautadaFeedbackCapitulo(fechaEnvioAutor: string): string {
  return sumarDiasHabiles(fechaEnvioAutor, DIAS_HABILES_FEEDBACK_AUTOR_CAPITULO);
}

// Mismo criterio, para el feedback de TRIPA COMPLETA (plazo distinto:
// 5 días hábiles, no 3 — ver proyectos.fechaFeedbackTripa).
export function calcularFechaPautadaFeedbackTripa(fechaEnvio: string): string {
  return sumarDiasHabiles(fechaEnvio, DIAS_HABILES_FEEDBACK_AUTOR_TRIPA);
}
