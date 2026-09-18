import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ASESORIA_ESTADOS,
  ASESORIA_FASES,
  ASESORIA_FERIAS_A_PARTICIPAR,
  ASESORIA_FERIAS_PROYECTADAS,
  ASESORIA_FUTURO_AUTOR,
  ASESORIA_NIVELES_SATISFACCION,
  ASESORIA_RESPONSABLES_DISTRIBUCION,
  ASESORIA_RESPONSABLES_IMPRESION,
  COLECCIONES_PANHOUSE,
  CONDICIONES_ESPECIALES,
  EJECUCIONES_SERVICIO,
  ESTADOS_COTIZACION_IMPRESION,
  ESTADOS_REUNION,
  PARTICIPACION_FERIAS,
  PRESUPUESTOS_SERVICIO,
  PROPIETARIOS_MATRIZ_INGRESO,
  PUBLICOS_SEXO,
  SUBTIPOS_CRUDO,
  TIPOS_PORTADA,
} from '../db/schema/index.js';
import {
  verificarAccesoAProyecto,
  verificarAccesoControlCalidad,
  verificarAccesoControlDigital,
  verificarAccesoControlDistribucion,
  verificarAccesoControlLanzamiento,
} from '../helpers/proyectos.js';
import {
  actualizarBriefDiseno,
  actualizarFaseCalidad,
  actualizarPaisDistribucion,
  actualizarPropuestaDiseno,
  actualizarReunionLanzamiento,
  actualizarSeccionCalidadControl,
  actualizarSeccionCorreccion,
  actualizarSeccionDigitalControl,
  actualizarSeccionDisenoControl,
  actualizarSeccionDistribucionControl,
  actualizarSeccionEdicion,
  actualizarSeccionFichaEditorial,
  actualizarSeccionImpresion,
  actualizarSeccionLanzamientoControl,
  actualizarSeccionLanzamientoGeneral,
  actualizarSeccionLanzamientoPromocion,
  actualizarSeccionMatrizAsesorias,
  actualizarSeccionMatrizIngreso,
  actualizarSeccionProyectoContrato,
  actualizarSeccionProyectoPerfil,
  actualizarSeccionSoporteDigital,
  agregarFaseCalidad,
  agregarPaisDistribucion,
  agregarPropuestaDiseno,
  agregarReunionLanzamiento,
  eliminarFaseCalidad,
  eliminarPaisDistribucion,
  eliminarPropuestaDiseno,
  eliminarReunionLanzamiento,
  listarProyectosEnviadosARrpp,
  listarProyectosPendientesCalidad,
  listarProyectosPendientesContrato,
  listarProyectosPendientesDiseno,
  listarProyectosPendientesPerfil,
  listarProyectosPendientesSoporteDigital,
  obtenerFichaCompleta,
} from '../helpers/trazabilidad.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const proyectoIdParamSchema = z.object({ proyectoId: z.string().uuid() });

// Params de las rutas por fila (editar/borrar una entrada puntual de
// las secciones que son varias filas por naturaleza).
const disenoPropuestaParamsSchema = z.object({ proyectoId: z.string().uuid(), propuestaId: z.string().uuid() });
const calidadFaseParamsSchema = z.object({ proyectoId: z.string().uuid(), faseId: z.string().uuid() });
const lanzamientoReunionParamsSchema = z.object({ proyectoId: z.string().uuid(), reunionId: z.string().uuid() });
const distribucionPaisParamsSchema = z.object({ proyectoId: z.string().uuid(), paisId: z.string().uuid() });

// Sección 1 — Proyecto, partida en dos dueños.
const seccionProyectoPerfilSchema = z
  .object({
    ingresoFechaIngreso: z.string().nullable().optional(),
    ingresoFechaCierre: z.string().nullable().optional(),
    // Solo tiene sentido cuando el servicio contratado es 'Crudo' — RRPP
    // lo llena después de que Comercial crea el proyecto. Nullable sin
    // .superRefine que lo exija (a diferencia de ingresoTiempoExpresMeses
    // más abajo): acá lo "pendiente" es el estado esperado y correcto
    // mientras RRPP no decide, no un dato faltante que haya que forzar.
    ingresoServicioSubtipoCrudo: z.enum(SUBTIPOS_CRUDO).nullable().optional(),
    // Sin .nullable() ni .default(), a diferencia del resto de este
    // objeto — mismo criterio que autores.categoria (ver
    // server/routes/autores.routes.ts): son NOT NULL en la base, no se
    // pueden "borrar" a null, y omitirlas en un PATCH parcial debe dejar
    // el valor actual intacto, no resetearlo al default.
    ingresoServicioEjecucion: z.enum(EJECUCIONES_SERVICIO).optional(),
    // Solo obligatorio cuando ingresoServicioEjecucion === 'Express' —
    // ver el .superRefine más abajo. Nullable: un proyecto 'Normal'
    // legítimamente nunca lo llena.
    ingresoTiempoExpresMeses: z.number().int().nullable().optional(),
    ingresoServicioAlianza: z.boolean().optional(),
    ingresoServicioPresupuesto: z.enum(PRESUPUESTOS_SERVICIO).nullable().optional(),
    ingresoObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  })
  // Solo valida la co-presencia dentro de ESTE body puntual — si un
  // PATCH no toca ingresoServicioEjecucion en absoluto, no hay forma de
  // saber el valor actual sin otra consulta, así que no se exige nada.
  // SeccionProyectoPerfil.tsx siempre manda la sección completa junta
  // (ver su mutación), así que en la práctica esto sí cubre el caso real.
  .superRefine((datos, ctx) => {
    if (datos.ingresoServicioEjecucion === 'Express' && (datos.ingresoTiempoExpresMeses === null || datos.ingresoTiempoExpresMeses === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingresoTiempoExpresMeses'],
        message: 'Tiempo Exprés (meses) es obligatorio cuando la ejecución es Express',
      });
    }
  });

const seccionProyectoContratoSchema = z.object({
  // string, no number: <select> de opciones predefinidas ('1 a 5'/'6 a
  // 10'/'11 a 20' para capítulos; '50'/'100'/'150'/'200' para páginas,
  // ver el bloque "Capítulos y páginas" en SeccionProyectoPerfil.tsx), no
  // un número libre — un rango como '1 a 5' no pasaría z.number(). Sin
  // z.enum() a propósito (a diferencia de condicionesEspeciales abajo):
  // son opciones temporales/placeholder mientras el negocio no define
  // los rangos reales, no un catálogo cerrado confirmado todavía.
  capitulosPactados: z.string().nullable().optional(),
  paginasPactadas: z.string().nullable().optional(),
  criterioExtra: z.string().nullable().optional(),
  // Array (no un solo valor) — mismo criterio que nacionalidadSchema en
  // autores.routes.ts: selección múltiple sobre un catálogo cerrado, ver
  // SelectorMultipleCondicionesEspeciales.tsx.
  condicionesEspeciales: z.array(z.enum(CONDICIONES_ESPECIALES)).nullable().optional(),
});

// "Ficha Editorial (Completado por RRPP)" — dueño rrpp/jefe_area, no
// comercial (a diferencia de los dos schemas de arriba). publicoEdad/
// tonoEstilo: string libre, no z.enum() — <select> de sugerencias en el
// frontend, no un catálogo cerrado confirmado todavía (mismo criterio
// que capitulosPactados/paginasPactadas arriba).
const seccionFichaEditorialSchema = z.object({
  fechaDeseadaCulminacion: z.string().nullable().optional(),
  temaGeneral: z.string().nullable().optional(),
  posibleTituloLibro: z.string().nullable().optional(),
  coleccionPanhouse: z.enum(COLECCIONES_PANHOUSE).nullable().optional(),
  tonoEstilo: z.string().nullable().optional(),
  publicoSexo: z.enum(PUBLICOS_SEXO).nullable().optional(),
  publicoEdad: z.string().nullable().optional(),
  publicoPerfil: z.string().nullable().optional(),
  propositoSocial: z.string().nullable().optional(),
  // Array de texto libre — mismo criterio que nacionalidadSchema en
  // autores.routes.ts: sin catálogo cerrado, ver EtiquetasObjetivoComercial.tsx.
  objetivoComercial: z.array(z.string()).nullable().optional(),
});

// "Matriz de Ingreso (RRPP)" — dueño rrpp/jefe_area, mismo alcance que
// seccionFichaEditorialSchema arriba.
const seccionMatrizIngresoSchema = z.object({
  matrizCiudadResidencia: z.string().nullable().optional(),
  matrizEstadoReunion: z.enum(ESTADOS_REUNION).nullable().optional(),
  matrizPropietario: z.enum(PROPIETARIOS_MATRIZ_INGRESO).nullable().optional(),
  matrizContratoFirmado: z.boolean().optional(),
  matrizBienvenidaGenerada: z.boolean().optional(),
  matrizLinkResumen: z.string().nullable().optional(),
  matrizDiagnosticoGenerado: z.boolean().optional(),
  matrizLinkDiagnostico: z.string().nullable().optional(),
  matrizIngresoGenerado: z.boolean().optional(),
  matrizFechaReunionCreativa: z.string().nullable().optional(),
  // Array de texto libre — mismo criterio que objetivoComercial arriba.
  matrizVentaCruzada: z.array(z.string()).nullable().optional(),
  matrizObservacionesComerciales: z.string().nullable().optional(),
});

// "Proceso de Lanzamiento y Promoción" — dueño rrpp, mismo alcance que
// seccionMatrizIngresoSchema arriba. No confundir con
// seccionLanzamientoGeneralSchema/lanzamientoControlSchema más abajo
// (Sección 7, otro dueño de columnas — ver el comentario completo en
// schema/trazabilidad.ts).
const seccionLanzamientoPromocionSchema = z.object({
  lanzamientoPromocionFechaPrimeraReunion: z.string().nullable().optional(),
  lanzamientoPromocionEncargadoPrimeraReunion: z.enum(PROPIETARIOS_MATRIZ_INGRESO).nullable().optional(),
  lanzamientoPromocionPuntosTratadosPrimera: z.string().nullable().optional(),
  lanzamientoPromocionFechaSegundaReunion: z.string().nullable().optional(),
  lanzamientoPromocionEncargadoSegundaReunion: z.enum(PROPIETARIOS_MATRIZ_INGRESO).nullable().optional(),
  lanzamientoPromocionAcuerdosSegunda: z.string().nullable().optional(),
  lanzamientoPromocionObjetivoComercial: z.string().nullable().optional(),
  lanzamientoPromocionParticipacionFerias: z.enum(PARTICIPACION_FERIAS).nullable().optional(),
  lanzamientoPromocionIsbn: z.string().nullable().optional(),
  lanzamientoPromocionDetallesProyeccion: z.string().nullable().optional(),
  lanzamientoPromocionFechaTentativa: z.string().nullable().optional(),
  lanzamientoPromocionTipo: z.string().nullable().optional(),
  lanzamientoPromocionObservaciones: z.string().nullable().optional(),
  lanzamientoPromocionObservacionesGenerales: z.string().nullable().optional(),
  lanzamientoPromocionLinkMinuta: z.string().nullable().optional(),
});

// "Matriz de Asesorías con fechas" — dueño rrpp/jefe_area, mismo alcance
// que seccionMatrizIngresoSchema arriba.
const seccionMatrizAsesoriasSchema = z.object({
  asesoriaEstado: z.enum(ASESORIA_ESTADOS).nullable().optional(),
  asesoriaEspecialistaResponsable: z.string().nullable().optional(),
  asesoriaFechaPrimeraReunion: z.string().nullable().optional(),
  asesoriaFechaSegundaReunion: z.string().nullable().optional(),
  asesoriaFechaAdicional: z.string().nullable().optional(),
  asesoriaIsbnPais: z.string().nullable().optional(),
  asesoriaNivelSatisfaccion: z.enum(ASESORIA_NIVELES_SATISFACCION).nullable().optional(),
  asesoriaFase: z.enum(ASESORIA_FASES).nullable().optional(),
  asesoriaFechaSugeridaGe: z.string().nullable().optional(),
  asesoriaFechaPautadaAutor: z.string().nullable().optional(),
  asesoriaFeriaProyectada: z.enum(ASESORIA_FERIAS_PROYECTADAS).nullable().optional(),
  asesoriaNotas: z.string().nullable().optional(),
  asesoriaLinkMinutaGerencia: z.string().nullable().optional(),
  asesoriaRutaPromocionEnviada: z.boolean().optional(),
  asesoriaLinkRutaPromocion: z.string().nullable().optional(),
  asesoriaFuturoAutor: z.enum(ASESORIA_FUTURO_AUTOR).nullable().optional(),
  asesoriaInfoFeriaEnviada: z.boolean().optional(),
  asesoriaParticipacionFeria: z.boolean().optional(),
  asesoriaFeriaAParticipar: z.enum(ASESORIA_FERIAS_A_PARTICIPAR).nullable().optional(),
  asesoriaCotizacionImpresion: z.boolean().optional(),
  asesoriaResponsableImpresion: z.enum(ASESORIA_RESPONSABLES_IMPRESION).nullable().optional(),
  asesoriaFechaCotizacionSolicitada: z.string().nullable().optional(),
  asesoriaFechaCotizacionEnviada: z.string().nullable().optional(),
  asesoriaCotizacionAceptada: z.boolean().optional(),
  asesoriaDistribucionAceptada: z.boolean().optional(),
  asesoriaResponsableDistribucion: z.enum(ASESORIA_RESPONSABLES_DISTRIBUCION).nullable().optional(),
  asesoriaNotaDistribucion: z.string().nullable().optional(),
  asesoriaFechaContratoEnviado: z.string().nullable().optional(),
  asesoriaContratoRecibidoFirmado: z.boolean().optional(),
});

// Sección 2 — Edición de estilo.
const seccionEdicionSchema = z
  .object({
    edicionEstatus: z.string().nullable().optional(),
    edicionFechaEnvioEditor: z.string().nullable().optional(),
    edicionFechaRecepcionEditor: z.string().nullable().optional(),
    edicionFechaEnvioAutor: z.string().nullable().optional(),
    edicionFechaAprobacionAutor: z.string().nullable().optional(),
    edicionObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 3 — Corrección.
const seccionCorreccionSchema = z
  .object({
    correccionTripaCompleta: z.string().nullable().optional(),
    correccionTripaCompletaFechaEntrega: z.string().nullable().optional(),
    correccionTripaCompletaAprobado: z.boolean().nullable().optional(),
    correccionPreliminares: z.string().nullable().optional(),
    correccionPreliminaresFechaEntrega: z.string().nullable().optional(),
    correccionPreliminaresAprobado: z.boolean().nullable().optional(),
    correccionCubiertaExtendida: z.string().nullable().optional(),
    correccionCubiertaExtendidaFechaEntrega: z.string().nullable().optional(),
    correccionCubiertaExtendidaAprobado: z.boolean().nullable().optional(),
    correccionEstatus: z.string().nullable().optional(),
    correccionTipoAsignacion: z.string().nullable().optional(),
    correccionFechaEnvio: z.string().nullable().optional(),
    correccionFechaInicio: z.string().nullable().optional(),
    correccionFechaEntrega: z.string().nullable().optional(),
    correccionTotalDias: z.string().nullable().optional(),
    correccionObservaciones: z.string().nullable().optional(),
  })
  // Cualquier campo desconocido llega vacío tras el parseo de Zod. Sin
  // este refine, un body así llega vacío al helper y hace truncar el
  // update en Drizzle ("No values to set") en vez de avisar con un 400
  // claro.
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 4 — Diseño. Campos del brief confirmados contra la matriz
// real de Dirección Creativa: disenoBriefAprobadoFecha no tiene un
// booleano/estado aparte — la presencia de fecha ya es la aprobación,
// igual que en el documento real.
const disenoBriefSchema = z
  .object({
    disenoBriefCreativo: z.string().nullable().optional(),
    disenoTipoPortada: z.enum(TIPOS_PORTADA).nullable().optional(),
    disenoFechaReunionCreativa: z.string().nullable().optional(),
    disenoFechaEntregaBrief: z.string().nullable().optional(),
    disenoBriefAprobadoFecha: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 4 (parte 2) — Diseño, estatus agregado (macro). Dueño doble
// (especialista o disenador asignado) — ver PATCH /:proyectoId/diseno-control.
const disenoControlSchema = z
  .object({
    disenoEstatus: z.string().nullable().optional(),
    disenoFechaInicio: z.string().nullable().optional(),
    disenoFechaEntrega: z.string().nullable().optional(),
    disenoTotalDias: z.string().nullable().optional(),
    disenoObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// estado queda como texto libre a propósito — el conjunto completo de
// valores posibles todavía no está confirmado, no forzar un enum
// cerrado antes de tiempo (ver server/db/schema/trazabilidad.ts).
const disenoPropuestaSchema = z.object({
  fechaEnviadaEspecialista: z.string().nullable().optional(),
  fechaEnviadaAutor: z.string().nullable().optional(),
  fechaAprobadaAutor: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  enlace: z.string().nullable().optional(),
});

// Sección 5 (parte 2) — Calidad, estatus agregado (macro). Dueño doble
// (especialista o analista de calidad asignado) — ver PATCH
// /:proyectoId/calidad-control.
const calidadControlSchema = z
  .object({
    calidadEstatus: z.string().nullable().optional(),
    calidadFechaInicio: z.string().nullable().optional(),
    calidadFechaEntrega: z.string().nullable().optional(),
    calidadTotalDias: z.string().nullable().optional(),
    calidadObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 5 — Calidad.
const calidadFaseSchema = z.object({
  numeroFase: z.number().int().min(1).max(4),
  pdfUrl: z.string().nullable().optional(),
  pdfVersion: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
  aprobado: z.boolean().nullable().optional(),
});

// Sección 6 — Soporte digital.
const soporteDigitalSchema = z.object({
  soporteDigitalCuentaAmazon: z.string().nullable().optional(),
  soporteDigitalFechaEnvioFormulario: z.string().nullable().optional(),
  soporteDigitalFechaActivacion: z.string().nullable().optional(),
});

// Sección 6 (parte 2) — Soporte digital, estatus agregado (macro). Dueño
// doble (especialista o encargado digital asignado) — ver PATCH
// /:proyectoId/digital-control.
const digitalControlSchema = z
  .object({
    digitalEstatus: z.string().nullable().optional(),
    digitalFechaInicio: z.string().nullable().optional(),
    digitalFechaEntrega: z.string().nullable().optional(),
    digitalTotalDias: z.string().nullable().optional(),
    digitalObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 7 — Lanzamiento y promoción. nivelSatisfaccion queda como
// texto libre a propósito — el tipo de dato exacto todavía no está
// confirmado (ver server/db/schema/trazabilidad.ts).
const lanzamientoGeneralSchema = z
  .object({
    nivelSatisfaccion: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

const lanzamientoReunionSchema = z.object({
  fecha: z.string().nullable().optional(),
  puntosTratados: z.string().nullable().optional(),
  acuerdos: z.string().nullable().optional(),
});

// Sección 7 (parte 3) — Lanzamiento, estatus agregado (macro). Dueño
// doble (especialista o responsable de lanzamiento asignado) — ver
// PATCH /:proyectoId/lanzamiento-control.
const lanzamientoControlSchema = z
  .object({
    lanzamientoEstatus: z.string().nullable().optional(),
    lanzamientoFechaInicio: z.string().nullable().optional(),
    lanzamientoFechaEntrega: z.string().nullable().optional(),
    lanzamientoTotalDias: z.string().nullable().optional(),
    lanzamientoObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 9 — Distribución.
const distribucionPaisSchema = z.object({
  pais: z.string().min(1),
  porcentajeRegalias: z.string().nullable().optional(),
});

// Sección 9 (parte 2) — Distribución, estatus agregado (macro). Dueño
// doble (especialista o responsable logístico asignado) — ver PATCH
// /:proyectoId/distribucion-control.
const distribucionControlSchema = z
  .object({
    distribucionEstatus: z.string().nullable().optional(),
    distribucionFechaInicio: z.string().nullable().optional(),
    distribucionFechaEntrega: z.string().nullable().optional(),
    distribucionTotalDias: z.string().nullable().optional(),
    distribucionObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

// Sección 8 — Impresión. Incluye el estatus agregado (macro, parte 2):
// sin dueño individual (no existe impresionId en proyectos), sigue
// usando verificarAccesoAProyecto compartido — mismo alcance de rol
// (rrpp/jefe_area) para ambas partes de la sección.
const seccionImpresionSchema = z
  .object({
    impresionDeseaCotizacion: z.boolean().nullable().optional(),
    impresionResponsable: z.string().nullable().optional(),
    impresionEstadoCotizacion: z.enum(ESTADOS_COTIZACION_IMPRESION).nullable().optional(),
    impresionNotas: z.string().nullable().optional(),
    impresionEstatus: z.string().nullable().optional(),
    impresionFechaInicio: z.string().nullable().optional(),
    impresionFechaEntrega: z.string().nullable().optional(),
    impresionTotalDias: z.string().nullable().optional(),
    impresionObservaciones: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

export async function trazabilidadRoutes(app: FastifyInstance) {
  // Ficha completa (las nueve secciones en una sola llamada): el
  // especialista dueño del proyecto, jefe_area, y todos los roles
  // dueños de alguna sección — necesitan leerla antes de editar la
  // suya y confirmar que quedó guardada.
  app.get(
    '/:proyectoId',
    {
      preHandler: [
        requireAuth,
        requireRole(
          'jefe_area',
          'especialista',
          'rrpp',
          'comercial',
          'disenador',
          'lider_creativo',
          'soporte_editorial',
          'soporte_digital',
        ),
      ],
    },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }

      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const ficha = await obtenerFichaCompleta(params.proyectoId);
      if (!ficha) {
        return reply.code(404).send({ error: 'Ficha de trazabilidad no encontrada' });
      }

      return reply.send({ ficha });
    },
  );

  // "Notificación interna" de rrpp: pantalla de inicio, sin ruta propia
  // todavía antes de esto (ver HomePage.tsx en el frontend).
  app.get('/pendientes/perfil', { preHandler: [requireAuth, requireRole('rrpp')] }, async (_request, reply) => {
    const proyectos = await listarProyectosPendientesPerfil();
    return reply.send({ proyectos });
  });

  // "Matrices de Ingreso (RRPP)": módulo propio en el inicio de rrpp,
  // fuera de la vista de detalle del proyecto — ver el comentario
  // completo en listarProyectosEnviadosARrpp (helpers/trazabilidad.ts).
  // jefe_area también puede (mismo alcance que PATCH .../matriz-ingreso).
  app.get('/enviados-a-rrpp', { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] }, async (_request, reply) => {
    const proyectos = await listarProyectosEnviadosARrpp();
    return reply.send({ proyectos });
  });

  // "Notificación interna" de comercial: sección extra en su pantalla ya
  // existente, junto al formulario de crear autor.
  app.get('/pendientes/contrato', { preHandler: [requireAuth, requireRole('comercial')] }, async (_request, reply) => {
    const proyectos = await listarProyectosPendientesContrato();
    return reply.send({ proyectos });
  });

  // "Notificación interna" de disenador (también lider_creativo, dueño
  // de la misma sección, aunque su pantalla propia no se construye
  // todavía): pantalla de inicio.
  app.get(
    '/pendientes/diseno',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (_request, reply) => {
      const proyectos = await listarProyectosPendientesDiseno();
      return reply.send({ proyectos });
    },
  );

  // "Notificación interna" de soporte_editorial: pantalla de inicio.
  app.get('/pendientes/calidad', { preHandler: [requireAuth, requireRole('soporte_editorial')] }, async (_request, reply) => {
    const proyectos = await listarProyectosPendientesCalidad();
    return reply.send({ proyectos });
  });

  // "Notificación interna" de soporte_digital: pantalla de inicio.
  app.get(
    '/pendientes/soporte-digital',
    { preHandler: [requireAuth, requireRole('soporte_digital')] },
    async (_request, reply) => {
      const proyectos = await listarProyectosPendientesSoporteDigital();
      return reply.send({ proyectos });
    },
  );

  app.patch(
    '/:proyectoId/proyecto-perfil',
    { preHandler: [requireAuth, requireRole('comercial', 'rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionProyectoPerfilSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionProyectoPerfil(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/proyecto-contrato',
    { preHandler: [requireAuth, requireRole('comercial')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionProyectoContratoSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionProyectoContrato(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  // Dueño rrpp/jefe_area, no comercial — a diferencia de las dos rutas
  // de arriba (proyecto-perfil, proyecto-contrato). "(y Comercial si lo
  // deseas)" del pedido original NO se aplicó acá a propósito: el pedido
  // es explícito en que Comercial ve esta sección en modo lectura, no
  // que pueda editarla.
  app.patch(
    '/:proyectoId/ficha-editorial',
    { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionFichaEditorialSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionFichaEditorial(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/matriz-ingreso',
    { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionMatrizIngresoSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionMatrizIngreso(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  // "Proceso de Lanzamiento y Promoción" — mismo alcance que PATCH
  // .../matriz-ingreso arriba (rrpp/jefe_area, ver el comentario
  // completo en schema/trazabilidad.ts).
  app.patch(
    '/:proyectoId/lanzamiento-promocion',
    { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionLanzamientoPromocionSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionLanzamientoPromocion(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  // "Matriz de Asesorías con fechas" — mismo alcance que PATCH
  // .../matriz-ingreso arriba (rrpp/jefe_area, ver el comentario
  // completo en schema/trazabilidad.ts).
  app.patch(
    '/:proyectoId/matriz-asesorias',
    { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionMatrizAsesoriasSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionMatrizAsesorias(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/edicion',
    { preHandler: [requireAuth, requireRole('especialista')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionEdicionSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionEdicion(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/correccion',
    { preHandler: [requireAuth, requireRole('especialista')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(seccionCorreccionSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionCorreccion(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  // Dueño doble (a diferencia del resto de la Sección 4): el
  // especialista dueño del proyecto O el disenador asignado —
  // verificarAccesoAProyecto ya resuelve las dos ramas, así que alcanza
  // con darle acceso a ambos roles y dejar que la función decida.
  app.patch(
    '/:proyectoId/diseno-control',
    { preHandler: [requireAuth, requireRole('especialista', 'disenador')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoControlSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionDisenoControl(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/diseno/brief',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoBriefSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarBriefDiseno(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/diseno/propuestas',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoPropuestaSchema, request.body, reply);
      if (!body) return;

      const propuesta = await agregarPropuestaDiseno(params.proyectoId, body);
      return reply.code(201).send({ propuesta });
    },
  );

  app.patch(
    '/:proyectoId/diseno/propuestas/:propuestaId',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(disenoPropuestaParamsSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(disenoPropuestaSchema, request.body, reply);
      if (!body) return;

      const propuesta = await actualizarPropuestaDiseno(params.proyectoId, params.propuestaId, body);
      if (!propuesta) {
        return reply.code(404).send({ error: 'Propuesta de diseño no encontrada' });
      }
      return reply.send({ propuesta });
    },
  );

  app.delete(
    '/:proyectoId/diseno/propuestas/:propuestaId',
    { preHandler: [requireAuth, requireRole('disenador', 'lider_creativo')] },
    async (request, reply) => {
      const params = parseOrReply(disenoPropuestaParamsSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const propuesta = await eliminarPropuestaDiseno(params.proyectoId, params.propuestaId);
      if (!propuesta) {
        return reply.code(404).send({ error: 'Propuesta de diseño no encontrada' });
      }
      return reply.send({ ok: true });
    },
  );

  // Dueño doble (a diferencia del resto de la Sección 5): el
  // especialista dueño del proyecto O el analista de calidad asignado —
  // usa verificarAccesoControlCalidad (no el verificarAccesoAProyecto
  // compartido, ver el comentario en helpers/proyectos.ts) porque
  // soporte_editorial mantiene acceso de grupo en el resto de esta
  // sección.
  app.patch(
    '/:proyectoId/calidad-control',
    { preHandler: [requireAuth, requireRole('especialista', 'soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoControlCalidad(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(calidadControlSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionCalidadControl(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/calidad/fases',
    { preHandler: [requireAuth, requireRole('soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(calidadFaseSchema, request.body, reply);
      if (!body) return;

      const fase = await agregarFaseCalidad(params.proyectoId, body);
      return reply.code(201).send({ fase });
    },
  );

  app.patch(
    '/:proyectoId/calidad/fases/:faseId',
    { preHandler: [requireAuth, requireRole('soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(calidadFaseParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(calidadFaseSchema, request.body, reply);
      if (!body) return;

      const fase = await actualizarFaseCalidad(params.proyectoId, params.faseId, body);
      if (!fase) {
        return reply.code(404).send({ error: 'Fase de calidad no encontrada' });
      }
      return reply.send({ fase });
    },
  );

  app.delete(
    '/:proyectoId/calidad/fases/:faseId',
    { preHandler: [requireAuth, requireRole('soporte_editorial')] },
    async (request, reply) => {
      const params = parseOrReply(calidadFaseParamsSchema, request.params, reply);
      if (!params) return;

      const fase = await eliminarFaseCalidad(params.proyectoId, params.faseId);
      if (!fase) {
        return reply.code(404).send({ error: 'Fase de calidad no encontrada' });
      }
      return reply.send({ ok: true });
    },
  );

  // Dueño doble (a diferencia del resto de la Sección 6): el
  // especialista dueño del proyecto O el encargado digital asignado —
  // usa verificarAccesoControlDigital (no el verificarAccesoAProyecto
  // compartido, ver el comentario en helpers/proyectos.ts) porque
  // soporte_digital mantiene acceso de grupo en el resto de esta sección.
  app.patch(
    '/:proyectoId/digital-control',
    { preHandler: [requireAuth, requireRole('especialista', 'soporte_digital')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoControlDigital(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(digitalControlSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionDigitalControl(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/soporte-digital',
    { preHandler: [requireAuth, requireRole('soporte_digital')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(soporteDigitalSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionSoporteDigital(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  // Dueño doble (a diferencia del resto de la Sección 7): el
  // especialista dueño del proyecto O el responsable de lanzamiento
  // asignado — usa verificarAccesoControlLanzamiento (no el
  // verificarAccesoAProyecto compartido, ver el comentario en
  // helpers/proyectos.ts) porque rrpp mantiene acceso de grupo en el
  // resto de esta sección.
  app.patch(
    '/:proyectoId/lanzamiento-control',
    { preHandler: [requireAuth, requireRole('especialista', 'rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoControlLanzamiento(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(lanzamientoControlSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionLanzamientoControl(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.patch(
    '/:proyectoId/lanzamiento/general',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(lanzamientoGeneralSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionLanzamientoGeneral(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/lanzamiento/reuniones',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(lanzamientoReunionSchema, request.body, reply);
      if (!body) return;

      const reunion = await agregarReunionLanzamiento(params.proyectoId, body);
      return reply.code(201).send({ reunion });
    },
  );

  app.patch(
    '/:proyectoId/lanzamiento/reuniones/:reunionId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(lanzamientoReunionParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(lanzamientoReunionSchema, request.body, reply);
      if (!body) return;

      const reunion = await actualizarReunionLanzamiento(params.proyectoId, params.reunionId, body);
      if (!reunion) {
        return reply.code(404).send({ error: 'Reunión de lanzamiento no encontrada' });
      }
      return reply.send({ reunion });
    },
  );

  app.delete(
    '/:proyectoId/lanzamiento/reuniones/:reunionId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(lanzamientoReunionParamsSchema, request.params, reply);
      if (!params) return;

      const reunion = await eliminarReunionLanzamiento(params.proyectoId, params.reunionId);
      if (!reunion) {
        return reply.code(404).send({ error: 'Reunión de lanzamiento no encontrada' });
      }
      return reply.send({ ok: true });
    },
  );

  app.patch(
    '/:proyectoId/impresion',
    { preHandler: [requireAuth, requireRole('rrpp', 'jefe_area')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoAProyecto(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(seccionImpresionSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionImpresion(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  // Dueño doble (a diferencia del resto de la Sección 9): el
  // especialista dueño del proyecto O el responsable logístico asignado
  // — usa verificarAccesoControlDistribucion (no el
  // verificarAccesoAProyecto compartido, ver el comentario en
  // helpers/proyectos.ts) porque rrpp mantiene acceso de grupo en el
  // resto de esta sección.
  app.patch(
    '/:proyectoId/distribucion-control',
    { preHandler: [requireAuth, requireRole('especialista', 'rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;

      if (!request.user) {
        return reply.code(401).send({ error: 'No autenticado' });
      }
      const acceso = await verificarAccesoControlDistribucion(params.proyectoId, request.user);
      if (!acceso.ok) {
        return reply.code(acceso.status).send({ error: acceso.error });
      }

      const body = parseOrReply(distribucionControlSchema, request.body, reply);
      if (!body) return;

      const ficha = await actualizarSeccionDistribucionControl(params.proyectoId, body);
      return reply.send({ ficha });
    },
  );

  app.post(
    '/:proyectoId/distribucion/paises',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(proyectoIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(distribucionPaisSchema, request.body, reply);
      if (!body) return;

      const pais = await agregarPaisDistribucion(params.proyectoId, body);
      return reply.code(201).send({ pais });
    },
  );

  app.patch(
    '/:proyectoId/distribucion/paises/:paisId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(distribucionPaisParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(distribucionPaisSchema, request.body, reply);
      if (!body) return;

      const pais = await actualizarPaisDistribucion(params.proyectoId, params.paisId, body);
      if (!pais) {
        return reply.code(404).send({ error: 'País de distribución no encontrado' });
      }
      return reply.send({ pais });
    },
  );

  app.delete(
    '/:proyectoId/distribucion/paises/:paisId',
    { preHandler: [requireAuth, requireRole('rrpp')] },
    async (request, reply) => {
      const params = parseOrReply(distribucionPaisParamsSchema, request.params, reply);
      if (!params) return;

      const pais = await eliminarPaisDistribucion(params.proyectoId, params.paisId);
      if (!pais) {
        return reply.code(404).send({ error: 'País de distribución no encontrado' });
      }
      return reply.send({ ok: true });
    },
  );
}