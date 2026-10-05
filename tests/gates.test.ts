import { describe, expect, it } from 'vitest';
import {
  evaluarGateAprobacionPortadaRrpp,
  evaluarGateAsignacionFormal,
  evaluarGateDefinicionCrudo,
  evaluarGateTituloAprobado,
} from '../server/helpers/gates.js';

// §17 del master prompt de rearquitectura: documentar y testear
// exactamente GATE-02/GATE-03 — qué habilitan, campos requeridos,
// comportamiento, sin agregar reglas "porque parecen lógicas".
describe('GATE-02 — Definición de Crudo', () => {
  it('desbloqueado trivialmente para cualquier servicio que no sea Crudo (CR)', () => {
    const resultado = evaluarGateDefinicionCrudo({ servicioCodigo: 'EF', ingresoServicioSubtipoCrudo: null });
    expect(resultado.desbloqueado).toBe(true);
  });

  it('bloqueado si el servicio es Crudo (CR) y RRPP todavía no definió el subtipo', () => {
    const resultado = evaluarGateDefinicionCrudo({ servicioCodigo: 'CR', ingresoServicioSubtipoCrudo: null });
    expect(resultado.desbloqueado).toBe(false);
    expect(resultado.motivo).toBeTruthy();
  });

  it('desbloqueado si el servicio es Crudo y RRPP ya definió el subtipo', () => {
    const resultado = evaluarGateDefinicionCrudo({ servicioCodigo: 'CR', ingresoServicioSubtipoCrudo: 'Tripa' });
    expect(resultado.desbloqueado).toBe(true);
  });
});

describe('GATE-03 — Asignación Formal', () => {
  it('bloqueado sin especialista asignado', () => {
    const resultado = evaluarGateAsignacionFormal({ especialistaId: null });
    expect(resultado.desbloqueado).toBe(false);
    expect(resultado.motivo).toBeTruthy();
  });

  it('desbloqueado una vez asignado el especialista', () => {
    const resultado = evaluarGateAsignacionFormal({ especialistaId: '00000000-0000-0000-0000-000000000000' });
    expect(resultado.desbloqueado).toBe(true);
  });
});

describe('GATE-04 — Título y Subtítulo Aprobados', () => {
  it('bloqueado sin título definitivo', () => {
    const resultado = evaluarGateTituloAprobado({ tituloDefinitivo: null, subtituloDefinitivo: null });
    expect(resultado.desbloqueado).toBe(false);
  });

  it('bloqueado con título pero sin subtítulo', () => {
    const resultado = evaluarGateTituloAprobado({ tituloDefinitivo: 'El valor del contrato privado', subtituloDefinitivo: null });
    expect(resultado.desbloqueado).toBe(false);
  });

  it('desbloqueado con título y subtítulo definitivos', () => {
    const resultado = evaluarGateTituloAprobado({
      tituloDefinitivo: 'El valor del contrato privado',
      subtituloDefinitivo: 'Una mirada desde el Derecho Inmobiliario',
    });
    expect(resultado.desbloqueado).toBe(true);
  });
});

describe('GATE-05 — Aprobación Interna de Portada (RRPP)', () => {
  it('bloqueado sin aprobación de RRPP', () => {
    const resultado = evaluarGateAprobacionPortadaRrpp({ fechaAprobadaRrpp: null });
    expect(resultado.desbloqueado).toBe(false);
  });

  it('desbloqueado una vez RRPP aprueba', () => {
    const resultado = evaluarGateAprobacionPortadaRrpp({ fechaAprobadaRrpp: '2026-02-04' });
    expect(resultado.desbloqueado).toBe(true);
  });
});
