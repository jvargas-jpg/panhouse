import { describe, expect, it } from 'vitest';
import {
  calcularFechaPautadaFeedbackCapitulo,
  calcularFechaPautadaFeedbackTripa,
  sumarDiasHabiles,
} from '../server/helpers/edicionSla.js';

// Fase 5 (5A Edición) — Manual del Especialista §2.3: "El editor tendrá
// 3 días hábiles" / "el autor tiene 3 días hábiles para feedback" /
// "tripa completa... el autor tiene 5 días para feedback".
describe('edicionSla — cálculo de plazos en días hábiles', () => {
  it('sumarDiasHabiles salta fines de semana', () => {
    // Viernes 2026-01-02 + 3 días hábiles -> lunes, martes, miércoles ->
    // 2026-01-07 (salta sábado 03 y domingo 04).
    expect(sumarDiasHabiles('2026-01-02', 3)).toBe('2026-01-07');
  });

  it('sumarDiasHabiles con 0 días devuelve la misma fecha', () => {
    expect(sumarDiasHabiles('2026-01-05', 0)).toBe('2026-01-05');
  });

  it('calcularFechaPautadaFeedbackCapitulo usa 3 días hábiles', () => {
    expect(calcularFechaPautadaFeedbackCapitulo('2026-01-05')).toBe(sumarDiasHabiles('2026-01-05', 3));
  });

  it('calcularFechaPautadaFeedbackTripa usa 5 días hábiles (distinto del capítulo)', () => {
    const capitulo = calcularFechaPautadaFeedbackCapitulo('2026-01-05');
    const tripa = calcularFechaPautadaFeedbackTripa('2026-01-05');
    expect(tripa).not.toBe(capitulo);
    expect(tripa).toBe(sumarDiasHabiles('2026-01-05', 5));
  });
});
