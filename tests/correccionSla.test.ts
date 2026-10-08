import { describe, expect, it } from 'vitest';
import {
  calcularDueAtCorreccion,
  evaluarPlazoCorreccion,
  requiereRevisionPreviaPorPaginas,
  sumarHorasContinuas,
  UMBRAL_PAGINAS_REVISION_PREVIA,
} from '../server/helpers/correccionSla.js';

// Fase 5 (5B Corrección) — Manual del Especialista §3.1: "Plazo de
// entrega: 5 días continuos" (confirmado idéntico contra la columna
// "Máximo días"/"Tiempo Correcto" de TRIPA COMPLETA en la Matriz real,
// ver Seguimiento Corrección - Innovación Editorial). Preliminares y
// Cubierta Extendida: ~0.5 día real en la Matriz — representado en
// HORAS (checkpoint 5B §0.1: no se redondea a 1 día de calendario,
// perdiendo la mitad del plazo real).
describe('correccionSla — horas continuas (no hábiles), sin redondeo de sub-día', () => {
  it('sumarHorasContinuas NO salta fines de semana (a diferencia de sumarDiasHabiles de edicionSla)', () => {
    // Viernes 2026-01-02T10:00Z + 72h (3 días) -> lunes 2026-01-05T10:00Z,
    // cuenta sábado y domingo, no los salta.
    expect(sumarHorasContinuas('2026-01-02T10:00:00.000Z', 72)).toBe('2026-01-05T10:00:00.000Z');
  });

  it('sumarHorasContinuas preserva exactamente medio día (12h), sin redondear a 1 día', () => {
    expect(sumarHorasContinuas('2026-01-05T08:00:00.000Z', 12)).toBe('2026-01-05T20:00:00.000Z');
  });

  it('calcularDueAtCorreccion usa 120h (5 días) para tripa_completa', () => {
    expect(calcularDueAtCorreccion('2026-01-05T08:00:00.000Z', 'tripa_completa')).toBe(sumarHorasContinuas('2026-01-05T08:00:00.000Z', 120));
  });

  it('calcularDueAtCorreccion usa 12h para preliminares — mitad de día real, no un día completo', () => {
    const dueAt = calcularDueAtCorreccion('2026-01-05T08:00:00.000Z', 'preliminares');
    expect(dueAt).toBe('2026-01-05T20:00:00.000Z');
    expect(dueAt).not.toBe(sumarHorasContinuas('2026-01-05T08:00:00.000Z', 24));
  });

  it('calcularDueAtCorreccion da el mismo plazo para cubierta_extendida que para preliminares', () => {
    expect(calcularDueAtCorreccion('2026-01-05T08:00:00.000Z', 'cubierta_extendida')).toBe(
      calcularDueAtCorreccion('2026-01-05T08:00:00.000Z', 'preliminares'),
    );
  });
});

// Manual, actualización "Proceso de Corrección - Equipo Freelance":
// "toda tripa que exceda las 120 páginas en Word deberá ser revisada
// previamente antes de su asignación a corrección".
describe('requiereRevisionPreviaPorPaginas — umbral de 120 páginas', () => {
  it(`no requiere revisión con exactamente ${UMBRAL_PAGINAS_REVISION_PREVIA} páginas`, () => {
    expect(requiereRevisionPreviaPorPaginas(UMBRAL_PAGINAS_REVISION_PREVIA)).toBe(false);
  });

  it(`requiere revisión con ${UMBRAL_PAGINAS_REVISION_PREVIA + 1} páginas`, () => {
    expect(requiereRevisionPreviaPorPaginas(UMBRAL_PAGINAS_REVISION_PREVIA + 1)).toBe(true);
  });

  it('no requiere revisión cuando no hay páginas registradas', () => {
    expect(requiereRevisionPreviaPorPaginas(null)).toBe(false);
    expect(requiereRevisionPreviaPorPaginas(undefined)).toBe(false);
  });
});

describe('evaluarPlazoCorreccion — en tiempo / próximo a vencer / vencido', () => {
  it('null si todavía no hay dueAt (corrección sin asignar)', () => {
    expect(evaluarPlazoCorreccion(null, null)).toBeNull();
  });

  it('en_tiempo cuando faltan más de 24h y no hay entrega', () => {
    const ahora = new Date('2026-01-05T12:00:00.000Z');
    expect(evaluarPlazoCorreccion('2026-01-08T12:00:00.000Z', null, ahora)).toBe('en_tiempo');
  });

  it('proximo_a_vencer cuando quedan 24h o menos y no hay entrega — incluye SLAs de 12h (preliminares/cubierta)', () => {
    const ahora = new Date('2026-01-05T12:00:00.000Z');
    // dueAt a solo 6h de "ahora" — un SLA de 12h ya está cerca de vencer,
    // no solo los de varios días.
    expect(evaluarPlazoCorreccion('2026-01-05T18:00:00.000Z', null, ahora)).toBe('proximo_a_vencer');
  });

  it('vencido cuando ya pasó el instante límite sin entrega', () => {
    const ahora = new Date('2026-01-12T12:00:00.000Z');
    expect(evaluarPlazoCorreccion('2026-01-10T12:00:00.000Z', null, ahora)).toBe('vencido');
  });

  it('en_tiempo si se entregó el mismo día calendario del vencimiento (sin hora registrada en la entrega)', () => {
    // dueAt cae a las 20:00 de un SLA de 12h; la entrega solo registra
    // el DÍA (nadie guarda la hora real de entrega) — comparar a nivel
    // de día evita marcar "vencido" un trabajo entregado a tiempo solo
    // porque la entrega no tiene hora.
    expect(evaluarPlazoCorreccion('2026-01-05T20:00:00.000Z', '2026-01-05')).toBe('en_tiempo');
  });

  it('vencido si la entrega es de un día calendario posterior al vencimiento', () => {
    expect(evaluarPlazoCorreccion('2026-01-05T20:00:00.000Z', '2026-01-06')).toBe('vencido');
  });
});


describe('entregas con precisión temporal real', () => {
  it('vence a las 10:00 y entrega a las 20:00 del mismo día: vencido', () => {
    expect(evaluarPlazoCorreccion('2026-01-05T10:00:00Z', '2026-01-05', new Date(), '2026-01-05T20:00:00Z')).toBe('vencido');
  });
  it('igual al límite: en tiempo, incluso con offset horario', () => {
    expect(evaluarPlazoCorreccion('2026-01-05T10:00:00Z', '2026-01-05', new Date(), '2026-01-05T06:00:00-04:00')).toBe('en_tiempo');
  });
  it('entrega temprana no se vuelve vencida al consultar días después', () => {
    expect(evaluarPlazoCorreccion('2026-01-05T10:00:00Z', '2026-01-05', new Date('2026-02-01'), '2026-01-05T09:59:59Z')).toBe('en_tiempo');
  });
});
