import { describe, expect, it } from 'vitest';
import {
  calcularDueAtCorreccion,
  evaluarPlazoCorreccion,
  requiereRevisionPreviaPorPaginas,
  sumarDiasContinuos,
  UMBRAL_PAGINAS_REVISION_PREVIA,
} from '../server/helpers/correccionSla.js';

// Fase 5 (5B Corrección) — Manual del Especialista §3.1: "Plazo de
// entrega: 5 días continuos" (confirmado idéntico contra la columna
// "Máximo días"/"Tiempo Correcto" de TRIPA COMPLETA en la Matriz real,
// ver Seguimiento Corrección - Innovación Editorial). Preliminares y
// Cubierta Extendida: 0.5 días reales en la Matriz, redondeados a 1 día
// de calendario (sin granularidad de horas en este schema).
describe('correccionSla — días continuos (no hábiles)', () => {
  it('sumarDiasContinuos NO salta fines de semana (a diferencia de sumarDiasHabiles de edicionSla)', () => {
    // Viernes 2026-01-02 + 3 días continuos -> lunes 2026-01-05 (cuenta
    // sábado y domingo, no los salta).
    expect(sumarDiasContinuos('2026-01-02', 3)).toBe('2026-01-05');
  });

  it('sumarDiasContinuos redondea hacia arriba un alcance de medio día', () => {
    expect(sumarDiasContinuos('2026-01-05', 0.5)).toBe(sumarDiasContinuos('2026-01-05', 1));
  });

  it('calcularDueAtCorreccion usa 5 días continuos para tripa_completa', () => {
    expect(calcularDueAtCorreccion('2026-01-05', 'tripa_completa')).toBe(sumarDiasContinuos('2026-01-05', 5));
  });

  it('calcularDueAtCorreccion usa un plazo distinto (más corto) para preliminares', () => {
    const tripa = calcularDueAtCorreccion('2026-01-05', 'tripa_completa');
    const preliminares = calcularDueAtCorreccion('2026-01-05', 'preliminares');
    expect(preliminares).not.toBe(tripa);
  });

  it('calcularDueAtCorreccion da el mismo plazo para cubierta_extendida que para preliminares', () => {
    expect(calcularDueAtCorreccion('2026-01-05', 'cubierta_extendida')).toBe(calcularDueAtCorreccion('2026-01-05', 'preliminares'));
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

  it('en_tiempo cuando faltan varios días y no hay entrega', () => {
    const ahora = new Date('2026-01-05T12:00:00.000Z');
    expect(evaluarPlazoCorreccion('2026-01-10', null, ahora)).toBe('en_tiempo');
  });

  it('proximo_a_vencer cuando queda un día o menos y no hay entrega', () => {
    const ahora = new Date('2026-01-10T12:00:00.000Z');
    expect(evaluarPlazoCorreccion('2026-01-10', null, ahora)).toBe('proximo_a_vencer');
  });

  it('vencido cuando ya pasó la fecha límite sin entrega', () => {
    const ahora = new Date('2026-01-12T12:00:00.000Z');
    expect(evaluarPlazoCorreccion('2026-01-10', null, ahora)).toBe('vencido');
  });

  it('en_tiempo si se entregó antes o en la fecha límite', () => {
    expect(evaluarPlazoCorreccion('2026-01-10', '2026-01-09')).toBe('en_tiempo');
    expect(evaluarPlazoCorreccion('2026-01-10', '2026-01-10')).toBe('en_tiempo');
  });

  it('vencido si se entregó después de la fecha límite (cumplimiento real, no se sobreescribe)', () => {
    expect(evaluarPlazoCorreccion('2026-01-10', '2026-01-12')).toBe('vencido');
  });
});
