import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { TraceabilityWorkspace } from './TraceabilityWorkspace';
import type { AutorConPerfil, FichaCompleta, ProyectoDetalleConAutores } from '../types/api';
import type { FinancialDetail } from '../../../shared/pagos';
vi.stubGlobal('React', React);

const autor: AutorConPerfil = {
  id: 'autor-1', nombre: 'Autora de prueba', nombreArtistico: null, nacionalidad: null,
  fechaNacimiento: null, redesSociales: null, personalidad: null, ocupacion: null, categoria: 'Estándar', pais: 'Venezuela',
};

function baseProyecto(overrides: Partial<ProyectoDetalleConAutores> = {}): ProyectoDetalleConAutores {
  return {
    subtipoCrudo: null, datoIncompleto: false, id: 'project-1', titulo: null, codigo: 'QA-001', estado: 'en_proceso',
    fechaProgramadaInicio: '2026-01-01', fechaRealInicio: null, fechaDeseadaAutor: null,
    disenadorId: null, especialistaId: null, editorId: null, correctorId: null, jefeAreaId: null,
    notificadoRrpp: false, rrppEnviadoAt: null, notificadoJefatura: false, fechaFeedbackTripa: null,
    autores: [autor], servicio: { id: 'servicio-1', codigo: 'SE', nombre: 'Servicio editorial' },
    riesgo: { diasEfectivosTranscurridos: 0, diasPlazo: 0, diasRestantes: 0, vencido: false, enRiesgo: false },
    ...overrides,
  };
}

function baseFicha(overrides: Partial<FichaCompleta> = {}): FichaCompleta {
  return {
    listoParaRrpp: false, faltantesComercial: ['capitulosPactados', 'paginasPactadas'],
    proyectoId: 'project-1', capitulosPactados: null, paginasPactadas: null, criterioExtra: null, condicionesEspeciales: null,
    fechaDeseadaCulminacion: null, temaGeneral: null, posibleTituloLibro: null, coleccionPanhouse: null, tonoEstilo: null,
    publicoSexo: null, publicoEdad: null, publicoPerfil: null, propositoSocial: null, objetivoComercial: null,
    matrizCiudadResidencia: null, matrizEstadoReunion: null, matrizPropietario: null, matrizContratoFirmado: false,
    matrizBienvenidaGenerada: false, matrizLinkResumen: null, matrizDiagnosticoGenerado: false, matrizLinkDiagnostico: null,
    matrizIngresoGenerado: false, matrizFechaReunionCreativa: null, matrizVentaCruzada: null, matrizObservacionesComerciales: null,
    lanzamientoPromocionFechaPrimeraReunion: null, lanzamientoPromocionEncargadoPrimeraReunion: null,
    lanzamientoPromocionPuntosTratadosPrimera: null, lanzamientoPromocionFechaSegundaReunion: null,
    lanzamientoPromocionEncargadoSegundaReunion: null, lanzamientoPromocionAcuerdosSegunda: null,
    lanzamientoPromocionObjetivoComercial: null, lanzamientoPromocionParticipacionFerias: null, lanzamientoPromocionIsbn: null,
    lanzamientoPromocionDetallesProyeccion: null, lanzamientoPromocionFechaTentativa: null, lanzamientoPromocionTipo: null,
    lanzamientoPromocionObservaciones: null, lanzamientoPromocionObservacionesGenerales: null, lanzamientoPromocionLinkMinuta: null,
    asesoriaEstado: null, asesoriaEspecialistaResponsable: null, asesoriaFechaPrimeraReunion: null, asesoriaFechaSegundaReunion: null,
    asesoriaFechaAdicional: null, asesoriaIsbnPais: null, asesoriaNivelSatisfaccion: null, asesoriaFase: null,
    asesoriaFechaSugeridaGe: null, asesoriaFechaPautadaAutor: null, asesoriaFeriaProyectada: null, asesoriaNotas: null,
    asesoriaLinkMinutaGerencia: null, asesoriaRutaPromocionEnviada: false, asesoriaLinkRutaPromocion: null,
    asesoriaFuturoAutor: null, asesoriaInfoFeriaEnviada: false, asesoriaParticipacionFeria: false, asesoriaFeriaAParticipar: null,
    asesoriaCotizacionImpresion: false, asesoriaResponsableImpresion: null, asesoriaFechaCotizacionSolicitada: null,
    asesoriaFechaCotizacionEnviada: null, asesoriaCotizacionAceptada: false, asesoriaDistribucionAceptada: false,
    asesoriaResponsableDistribucion: null, asesoriaNotaDistribucion: null, asesoriaFechaContratoEnviado: null,
    asesoriaContratoRecibidoFirmado: false,
    ingresoFechaIngreso: null, ingresoFechaCierre: null, ingresoServicioSubtipoCrudo: null, ingresoServicioEjecucion: 'Normal',
    ingresoTiempoExpresMeses: null, ingresoServicioAlianza: false, ingresoServicioPresupuesto: null, ingresoObservaciones: null,
    edicionEstatus: null, edicionFechaEnvioEditor: null, edicionFechaRecepcionEditor: null, edicionFechaEnvioAutor: null,
    edicionFechaAprobacionAutor: null, edicionObservaciones: null,
    correccionTripaCompleta: null, correccionTripaCompletaFechaEntrega: null, correccionTripaCompletaAprobado: null,
    correccionPreliminares: null, correccionPreliminaresFechaEntrega: null, correccionPreliminaresAprobado: null,
    correccionCubiertaExtendida: null, correccionCubiertaExtendidaFechaEntrega: null, correccionCubiertaExtendidaAprobado: null,
    correccionEstatus: null, correccionTipoAsignacion: null, correccionFechaEnvio: null, correccionFechaInicio: null,
    correccionFechaEntrega: null, correccionTotalDias: null, correccionObservaciones: null,
    disenoBriefCreativo: null, disenoTipoPortada: null, disenoFechaReunionCreativa: null, disenoFechaEntregaBrief: null,
    disenoBriefAprobadoFecha: null, disenoEstatus: null, disenoFechaInicio: null, disenoFechaEntrega: null,
    disenoTotalDias: null, disenoObservaciones: null, disenoPropuestas: [],
    calidadEstatus: null, calidadFechaInicio: null, calidadFechaEntrega: null, calidadTotalDias: null,
    calidadObservaciones: null, calidadFases: [],
    soporteDigitalCuentaAmazon: null, soporteDigitalFechaEnvioFormulario: null, soporteDigitalFechaActivacion: null,
    digitalEstatus: null, digitalFechaInicio: null, digitalFechaEntrega: null, digitalTotalDias: null, digitalObservaciones: null,
    nivelSatisfaccion: null, lanzamientoEstatus: null, lanzamientoFechaInicio: null, lanzamientoFechaEntrega: null,
    lanzamientoTotalDias: null, lanzamientoObservaciones: null, lanzamientoReuniones: [],
    impresionDeseaCotizacion: null, impresionResponsable: null, impresionEstadoCotizacion: null, impresionNotas: null,
    impresionEstatus: null, impresionFechaInicio: null, impresionFechaEntrega: null, impresionTotalDias: null,
    impresionObservaciones: null,
    distribucionEstatus: null, distribucionFechaInicio: null, distribucionFechaEntrega: null, distribucionTotalDias: null,
    distribucionObservaciones: null, distribucionPaises: [],
    ...overrides,
  };
}

function baseFinancial(overrides: Partial<FinancialDetail> = {}): FinancialDetail {
  return {
    id: 'project-1', codigo: 'QA-001', proyecto: 'Proyecto de prueba', autor: 'Autora de prueba', servicioId: 'servicio-1',
    servicio: 'Servicio editorial', estado: 'en_proceso', contractAmount: null, currency: null, confirmedPaid: null,
    pendingAmount: null, paidPercentage: null, paymentStatus: 'Sin monto contractual', solvencyStatus: 'Sin evaluar',
    financialGateStatus: 'No aplicable', gateSatisfied: true, gateRequired: false, gateAffectingWorkflow: false,
    lastPayment: null, pendingPayments: 0, currencyMismatch: false,
    revision: '2026-01-01T00:00:00Z', payments: [], historyTotal: 0, historyPage: 1,
    financialNotes: null, solvencyBy: null, solvencyAt: null, auditSummary: [],
    ...overrides,
  };
}

function render(proyecto: ProyectoDetalleConAutores, ficha: FichaCompleta, financial = baseFinancial()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['auth', 'me'], { id: 'comercial-1', rol: 'comercial', nombre: 'Comercial de prueba', email: 'comercial@qa.test' });
  client.setQueryData(['proyecto', proyecto.id], { proyecto });
  client.setQueryData(['ficha', proyecto.id], { ficha });
  client.setQueryData(['catalogos'], { servicios: [{ id: proyecto.servicio.id, codigo: proyecto.servicio.codigo, nombre: proyecto.servicio.nombre }], unidades: [], presupuestos: [] });
  client.setQueryData(['payments', 'project', proyecto.id, 1], financial);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/">
    <TraceabilityWorkspace proyectoId={proyecto.id} />
  </StaticRouter></QueryClientProvider>);
  client.clear();
  return html;
}

describe('Comercial · Resumen comercial del proyecto', () => {
  it('muestra cuántos y cuáles datos faltan, sin exponer las otras 8 áreas de la ficha', () => {
    const html = render(baseProyecto(), baseFicha());
    expect(html).toContain('Faltan 2 datos para completar el ingreso comercial');
    expect(html).toContain('Cantidad de capítulos');
    expect(html).toContain('Páginas pactadas');
    expect(html).toContain('Completar datos comerciales');
    expect(html).toContain('Información comercial');
    expect(html).toContain('Entrega a RRPP');
    expect(html).not.toContain('Corrección');
    expect(html).not.toContain('Diseño y diagramación');
    expect(html).not.toContain('Calidad editorial');
    expect(html).not.toContain('Soporte digital');
    expect(html).not.toContain('9 áreas');
  });

  it('proyecto listo para RRPP habilita el botón de envío y no muestra mensajes vagos', () => {
    const html = render(baseProyecto(), baseFicha({ listoParaRrpp: true, faltantesComercial: [], capitulosPactados: '6 a 10', paginasPactadas: '150' }));
    expect(html).toContain('✓ Información comercial completa');
    expect(html).not.toContain('Completa los datos marcados arriba');
    expect(html).toContain('Enviar a RRPP');
    const button = html.match(/<button[^>]*>Enviar a RRPP<\/button>/)?.[0] ?? '';
    expect(button).not.toContain('disabled=""');
  });

  it('proyecto ya enviado a RRPP muestra la entrega como hecho consultado, con estado actual y sin botón de envío', () => {
    const html = render(baseProyecto({ notificadoRrpp: true, rrppEnviadoAt: '2026-02-01T10:00:00Z', notificadoJefatura: true, especialistaId: 'esp-1' }),
      baseFicha({ listoParaRrpp: true, faltantesComercial: [] }));
    expect(html).toContain('✓ Proyecto enviado a RRPP');
    expect(html).toContain('Entregado a RRPP');
    expect(html).toContain('RRPP continuará con el diagnóstico inicial del proyecto');
    expect(html).toContain('Estado actual: En producción editorial');
    expect(html).not.toContain('>Enviar a RRPP<');
  });

  it('estado actual refleja el tramo real del handoff (RRPP / Jefatura) sin inventar un área de Calidad', () => {
    const enRrpp = render(baseProyecto({ notificadoRrpp: true, rrppEnviadoAt: '2026-02-01T10:00:00Z' }), baseFicha({ listoParaRrpp: true, faltantesComercial: [] }));
    expect(enRrpp).toContain('Estado actual: En RRPP');
    const enJefatura = render(baseProyecto({ notificadoRrpp: true, notificadoJefatura: true, rrppEnviadoAt: '2026-02-01T10:00:00Z' }), baseFicha({ listoParaRrpp: true, faltantesComercial: [] }));
    expect(enJefatura).toContain('Estado actual: En Jefatura');
  });

  it('muestra el resumen financiero con los campos reales, sin inventar un 80% fijo', () => {
    const html = render(baseProyecto(), baseFicha(), baseFinancial({ contractAmount: '1000.00', currency: 'USD', confirmedPaid: '250.00', pendingAmount: '750.00', paidPercentage: '25.00', solvencyStatus: 'Parcial' }));
    expect(html).toContain('1.000,00 USD');
    expect(html).toContain('25%');
    expect(html).toContain('Parcial');
    expect(html).not.toContain('80%');
  });

  it('sin monto contractual no muestra $0, muestra el estado explícito', () => {
    const html = render(baseProyecto(), baseFicha());
    expect(html).toContain('Sin monto contractual');
    expect(html).not.toContain('$0');
  });
});
