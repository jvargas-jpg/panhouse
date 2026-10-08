import { describe, expect, it } from 'vitest';
import {
  evaluarGateAprobacionPortadaRrpp,
  evaluarGateAsignacionFormal,
  evaluarGateBriefAprobadoParaConceptos,
  evaluarGateDefinicionCrudo,
  evaluarGateMomentoReunionCreativa,
  evaluarGateRevisionPreviaCorreccion,
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

describe('GATE-06 — Revisión Previa de Tripas Extensas (5B Corrección)', () => {
  it('desbloqueado trivialmente cuando no se requiere revisión previa', () => {
    const resultado = evaluarGateRevisionPreviaCorreccion({ requiereRevisionPrevia: false, revisionPreviaConfirmada: false });
    expect(resultado.desbloqueado).toBe(true);
  });

  it('bloqueado si se requiere revisión previa y todavía no se confirmó', () => {
    const resultado = evaluarGateRevisionPreviaCorreccion({ requiereRevisionPrevia: true, revisionPreviaConfirmada: false });
    expect(resultado.desbloqueado).toBe(false);
    expect(resultado.motivo).toBeTruthy();
  });

  it('desbloqueado una vez el Especialista confirma la revisión previa', () => {
    const resultado = evaluarGateRevisionPreviaCorreccion({ requiereRevisionPrevia: true, revisionPreviaConfirmada: true });
    expect(resultado.desbloqueado).toBe(true);
  });
});

describe('GATE-07 — Momento de Activación de la Reunión Creativa (5C)', () => {
  it('bloqueado sin título, sin importar el servicio', () => {
    const resultado = evaluarGateMomentoReunionCreativa({
      tituloDefinitivo: null,
      subtituloDefinitivo: null,
      servicioCodigo: 'SE',
      fechaFeedbackTripa: null,
    });
    expect(resultado.desbloqueado).toBe(false);
  });

  it('Sello (SE): desbloqueado con título, sin depender de fechaFeedbackTripa', () => {
    const resultado = evaluarGateMomentoReunionCreativa({
      tituloDefinitivo: 'Título',
      subtituloDefinitivo: 'Subtítulo',
      servicioCodigo: 'SE',
      fechaFeedbackTripa: null,
    });
    expect(resultado.desbloqueado).toBe(true);
  });

  it('Crudo (CR): bloqueado con título pero sin feedback de tripa completa', () => {
    const resultado = evaluarGateMomentoReunionCreativa({
      tituloDefinitivo: 'Título',
      subtituloDefinitivo: 'Subtítulo',
      servicioCodigo: 'CR',
      fechaFeedbackTripa: null,
    });
    expect(resultado.desbloqueado).toBe(false);
  });

  it('Ghost (EF): desbloqueado con título y feedback de tripa completa ya registrado', () => {
    const resultado = evaluarGateMomentoReunionCreativa({
      tituloDefinitivo: 'Título',
      subtituloDefinitivo: 'Subtítulo',
      servicioCodigo: 'EF',
      fechaFeedbackTripa: '2026-02-01',
    });
    expect(resultado.desbloqueado).toBe(true);
  });
});

describe('GATE-08 — Brief Aprobado Requerido para Conceptos (5C)', () => {
  it('bloqueado sin aprobación del autor sobre el brief', () => {
    const resultado = evaluarGateBriefAprobadoParaConceptos({ fechaBriefAprobadoAutor: null });
    expect(resultado.desbloqueado).toBe(false);
  });

  it('desbloqueado una vez el autor aprueba el brief', () => {
    const resultado = evaluarGateBriefAprobadoParaConceptos({ fechaBriefAprobadoAutor: '2026-02-05' });
    expect(resultado.desbloqueado).toBe(true);
  });
});
