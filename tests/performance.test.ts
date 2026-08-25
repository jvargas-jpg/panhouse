import { describe, expect, it } from 'vitest';
import { calcularDuracionEfectivaDias } from '../server/helpers/performance.js';

describe('calcularDuracionEfectivaDias', () => {
  it('descuenta el tiempo de una pausa cerrada dentro del rango', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fin = new Date('2026-01-11T00:00:00Z'); // 10 días

    const dias = calcularDuracionEfectivaDias(inicio, fin, [
      {
        fechaInicio: new Date('2026-01-03T00:00:00Z'),
        fechaFin: new Date('2026-01-06T00:00:00Z'), // 3 días pausados
      },
    ]);

    expect(dias).toBe(7);
  });

  it('no descuenta nada si no hay pausas', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fin = new Date('2026-01-06T00:00:00Z');

    expect(calcularDuracionEfectivaDias(inicio, fin, [])).toBe(5);
  });

  it('usa la fecha actual como fin de una pausa aún abierta', () => {
    const inicio = new Date('2026-01-01T00:00:00Z');
    const fin = new Date('2026-01-11T00:00:00Z');
    const ahora = new Date('2026-01-09T00:00:00Z');

    const dias = calcularDuracionEfectivaDias(
      inicio,
      fin,
      [{ fechaInicio: new Date('2026-01-05T00:00:00Z'), fechaFin: null }],
      ahora,
    );

    // 10 días totales; pausa abierta del 5 al 9 (usa "ahora"): 4 días pausados.
    expect(dias).toBe(6);
  });
});
