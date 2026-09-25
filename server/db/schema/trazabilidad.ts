import { boolean, check, date, integer, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { proyectos } from './proyectos.js';
import {
  asesoriaEstadoEnum,
  asesoriaFaseEnum,
  asesoriaFeriaAParticiparEnum,
  asesoriaFeriaProyectadaEnum,
  asesoriaFuturoAutorEnum,
  asesoriaNivelSatisfaccionEnum,
  asesoriaResponsableDistribucionEnum,
  asesoriaResponsableImpresionEnum,
  coleccionPanhouseEnum,
  condicionEspecialEnum,
  ejecucionServicioEnum,
  estadoCotizacionImpresionEnum,
  estadoReunionEnum,
  participacionFeriasEnum,
  presupuestoServicioEnum,
  propietarioMatrizIngresoEnum,
  publicoSexoEnum,
  subtipoCrudoEnum,
  tipoPortadaEnum,
} from './enums.js';

// Ficha de trazabilidad: documento maestro por proyecto (relación 1 a 1),
// nueve secciones confirmadas por jefatura. Las secciones sin
// repetición natural (1, 3, 4-brief, 6, 8) viven como columnas aquí;
// las que son varias filas por naturaleza (2 Edición, 5 Calidad,
// 4-propuestas Diseño, 7 Lanzamiento, 9 Distribución) tienen su propia
// tabla más abajo. Ningún campo de contenido es obligatorio: cada
// sección se guarda parcialmente completa, según vaya llegando en el
// proceso.
export const fichasTrazabilidad = pgTable('fichas_trazabilidad', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id')
    .notNull()
    .unique()
    .references(() => proyectos.id, { onDelete: 'cascade' }),

  // Sección 1 — Proyecto (encargo). Datos de contacto y país del autor
  // viven en `autores` (no se duplican aquí); nivel de presupuesto ya
  // existe como proyectos.presupuestoId (catálogo Plata/Oro/Platinium) y
  // tampoco se duplica. Capítulos/páginas aquí son la promesa
  // contractual — no existe hoy un total operativo agregado con el que
  // contrastarla; el avance real por capítulo vive en `capitulos`.
  //
  // perfilAutor/objetivosComerciales ("Resumen y Objetivos" del
  // formulario) se eliminaron a pedido explícito del negocio: texto
  // libre que venía de una plantilla de Excel vieja, sin uso real en
  // producción. listarProyectosPendientesPerfil (más abajo, en
  // helpers/trazabilidad.ts) usaba estas dos columnas como señal de "RRPP
  // ya tocó esta ficha" — ahora usa ingresoServicioPresupuesto/
  // ingresoObservaciones en su lugar, los dos únicos campos que quedan en
  // esa sección sin default.
  //
  // capitulosPactados/paginasPactadas: texto, no integer, a pedido
  // explícito del negocio — comercial todavía no define números exactos
  // al vender, así que el formulario (SeccionProyectoContrato.tsx) los
  // llena con un <select> de opciones predefinidas ('1 a 5'/'6 a
  // 10'/'11 a 20' para capítulos; '50'/'100'/'150'/'200' para páginas)
  // en vez de un número libre — un rango como '1 a 5' no es un integer
  // válido. Sin arithmetic en ningún lado del backend sobre estas dos
  // columnas (solo se comparan contra null, ver
  // listarProyectosPendientesContrato más abajo), así que el cambio de
  // tipo no rompe ningún cálculo existente.
  capitulosPactados: text('capitulos_pactados'),
  paginasPactadas: text('paginas_pactadas'),
  // Antes ingresoCriterioExtra/ingresoCondicionesEspeciales, texto libre
  // en la sección de RRPP ("Parámetros Técnicos y Equipo", eliminada —
  // ver el comentario más abajo, en la parte 3). El negocio las quiso de
  // vuelta acá, junto a capítulos/páginas (mismo dueño: comercial, misma
  // promesa contractual), pero condicionesEspeciales ahora cerrada a
  // CONDICIONES_ESPECIALES (schema/enums.ts) en vez de texto libre. Array
  // (no un solo valor) — el proyecto puede necesitar más de una a la vez
  // (ej. ilustraciones Y diagramación especial), mismo criterio que
  // autores.nacionalidad (chips sobre un catálogo cerrado, ver
  // SelectorMultipleCondicionesEspeciales.tsx).
  criterioExtra: text('criterio_extra'),
  condicionesEspeciales: condicionEspecialEnum('condiciones_especiales').array(),

  // Sección 1 (parte 3) — Datos de ingreso, matriz real provista por el
  // orquestador. Todo texto libre salvo las fechas (mismo patrón `date`
  // que el resto del archivo) — ningún valor cerrado está confirmado
  // todavía como enum.
  //
  // ingresoNombreArtistico/ingresoNacionalidad/ingresoFechaNacimiento/
  // ingresoRedesSociales/ingresoPersonalidad/ingresoOcupacion — que
  // vivían acá — se eliminaron: duplicaban uno a uno los campos que ya
  // existen en `autores` (nombreArtistico, nacionalidad, fechaNacimiento,
  // redesSociales, personalidad, ocupacion), que no cambian de un
  // proyecto a otro del mismo autor. Ver ese archivo.
  //
  // ingresoTipoProyecto/ingresoTipoProyectoDetalle también se
  // eliminaron por el mismo motivo: duplicaban la clasificación que ya
  // captura proyectos.servicioId (catálogo Servicio, elegido al crear
  // el proyecto) — ver el <select> de servicio en SeccionProyectoPerfil.tsx.
  //
  // ingresoTemaGeneral y ingresoFechaDeseada se habían eliminado acá
  // (ver el comentario histórico más abajo, junto al resto de "Ficha
  // Editorial") — el negocio las quiso de vuelta, ahora bajo otro dueño
  // (rrpp) y otra sección, no como parte de esta matriz de ingreso de
  // comercial. ingresoServicioPerfil (Estándar/VIP a nivel de PROYECTO,
  // cerrado a PERFILES_SERVICIO en schema/enums.ts) también se eliminó
  // — a pedido explícito: ese dato ya vive en `autores.categoria` (ver
  // CategoriaBadge.tsx), volver a pedirlo acá era redundante y una
  // fuente de datos que no coincidían. Esta sí se mantiene eliminada:
  // nada la trajo de vuelta.
  ingresoFechaIngreso: date('ingreso_fecha_ingreso'),
  ingresoFechaCierre: date('ingreso_fecha_cierre'),
  // Solo aplica cuando el servicio contratado (proyectos.servicioId) es
  // 'Crudo' — Comercial elige la categoría general al crear el proyecto
  // (ver CODIGOS_SERVICIO_PERMITIDOS_EN_ALTA en helpers/proyectos.ts),
  // RRPP define después cuál de los dos subtipos es. Nullable a
  // propósito, sin default: "pendiente de RRPP" es el estado real hasta
  // que alguien lo llena — el cálculo de Fecha de Cierre
  // (SeccionProyectoPerfil.tsx) se queda sin resolver mientras tanto.
  ingresoServicioSubtipoCrudo: subtipoCrudoEnum('ingreso_servicio_subtipo_crudo'),
  // Cerrado a Normal/Express (antes texto libre) — el equipo escribía
  // variaciones ("rápido", "urgente", "exprés") que después no se
  // podían filtrar de forma confiable. notNull + default: toda ficha
  // nueva nace en 'Normal' sin que nadie tenga que elegirlo a mano.
  ingresoServicioEjecucion: ejecucionServicioEnum('ingreso_servicio_ejecucion').notNull().default('Normal'),
  // Solo tiene sentido cuando ingresoServicioEjecucion = 'Express' — la
  // capa de validación (Zod, ver seccionProyectoPerfilSchema) exige el
  // valor en ese caso; acá se deja nullable a propósito (no NOT NULL: un
  // proyecto 'Normal' legítimamente nunca lo llena, no es un dato
  // "pendiente" de completar).
  ingresoTiempoExpresMeses: integer('ingreso_tiempo_expres_meses'),
  // Booleano (antes texto libre) — mismo motivo que ejecución arriba:
  // "Sí"/"no"/"SI"/vacío no se podía filtrar de forma confiable.
  ingresoServicioAlianza: boolean('ingreso_servicio_alianza').notNull().default(false),
  // Cerrado a Plata/Oro/Platinium — mismas etiquetas que el catálogo
  // real `presupuestos` (proyectos.presupuestoId) por coincidencia de
  // nomenclatura del negocio, pero es un campo de la matriz de ingreso,
  // no una FK a ese catálogo (ver PRESUPUESTOS_SERVICIO en schema/enums.ts).
  // Nullable sin default a propósito: junto con ingresoObservaciones de
  // abajo, es una de las dos únicas señales que le quedan a
  // listarProyectosPendientesPerfil (helpers/trazabilidad.ts) de que RRPP
  // ya completó su parte de esta sección.
  ingresoServicioPresupuesto: presupuestoServicioEnum('ingreso_servicio_presupuesto'),
  ingresoObservaciones: text('ingreso_observaciones'),

  // ingresoPublicoSexo/ingresoPublicoEdad/ingresoPublicoPerfil
  // ("Audiencia y Propósito") se eliminaron acá, pero volvieron más
  // abajo como publicoSexo/publicoEdad/publicoPerfil, bajo "Ficha
  // Editorial" — mismo motivo que ingresoTemaGeneral/ingresoFechaDeseada
  // más arriba: el negocio las quiso de vuelta con otro dueño (rrpp).
  // ingresoCantidadCapitulos/ingresoHojasDiagramadas/ingresoCriterioExtra/
  // ingresoCondicionesEspeciales/ingresoObservacionesEquipo
  // ("Parámetros Técnicos y Equipo") e ingresoCoordinador/
  // ingresoJefeDepartamento/ingresoEditor/ingresoCorrector/
  // ingresoDisenador/ingresoCalidad ("Equipo Editorial (Ingreso)") sí se
  // mantienen eliminadas — nada las trajo de vuelta. Nada de esto
  // alimentaba ningún cálculo ni pantalla fuera de su propio formulario
  // (a diferencia de perfilAutor/objetivosComerciales, ver el comentario
  // más arriba) — su eliminación no tocó ninguna otra función de este
  // archivo.

  // Sección "Ficha Editorial" (Completado por RRPP) — a pedido explícito
  // del negocio, revive campos que existían en "Datos de Ingreso" (ver
  // los comentarios de más arriba: ingresoTemaGeneral, ingresoFechaDeseada,
  // ingresoPublicoSexo/Edad/Perfil) pero bajo un dueño distinto: antes
  // los llenaba comercial como parte de la venta, ahora los llena rrpp
  // como parte de la caracterización editorial del libro — sección
  // propia, no una reactivación literal de la vieja matriz de ingreso.
  // publicoEdad/tonoEstilo: texto libre con <select> de sugerencias en
  // el frontend (SeccionFichaEditorial.tsx), no un enum — mismo patrón
  // que capitulosPactados/paginasPactadas más arriba (rangos que todavía
  // no son un catálogo cerrado confirmado). coleccionPanhouse/publicoSexo
  // sí cerrados a un enum — ver schema/enums.ts.
  fechaDeseadaCulminacion: date('fecha_deseada_culminacion'),
  temaGeneral: text('tema_general'),
  posibleTituloLibro: text('posible_titulo_libro'),
  coleccionPanhouse: coleccionPanhouseEnum('coleccion_panhouse'),
  tonoEstilo: text('tono_estilo'),
  publicoSexo: publicoSexoEnum('publico_sexo'),
  publicoEdad: text('publico_edad'),
  publicoPerfil: text('publico_perfil'),
  propositoSocial: text('proposito_social'),
  // Array (no un solo valor) — un proyecto puede perseguir más de un
  // objetivo comercial a la vez. Texto libre (no un catálogo cerrado,
  // a diferencia de condicionesEspeciales más arriba): el negocio no dio
  // una lista fija de opciones para este campo, mismo criterio que
  // autores.personalidad (chips de texto libre, ver
  // EtiquetasObjetivoComercial.tsx).
  objetivoComercial: text('objetivo_comercial').array(),

  // "Matriz de Ingreso (RRPP)" — nueva sección propia, dueño rrpp/
  // jefe_area (mismo alcance que "Ficha Editorial" arriba, comercial ve
  // de solo lectura). Bloque "Datos Sincronizados" del formulario real
  // (Nombre completo del autor, Nacionalidad, País de residencia, Fecha
  // de Ingreso, Título Tentativo) no se duplica acá: sale de
  // `autores`/ingresoFechaIngreso/posibleTituloLibro, ya existentes —
  // mismo criterio que el resto de este archivo (ver el comentario de
  // "Sección 1 (parte 3)" más arriba). Solo el bloque operativo (lo que
  // el negocio pidió editable) tiene columnas nuevas, todas con el
  // prefijo `matriz` para no chocar con `ingreso*` (dueño comercial,
  // otra sección) ni con proyectos.contratoFirmado (columna vieja de
  // "CONTROL ADMINISTRATIVO", nunca leída ni escrita por ninguna ruta —
  // se dejó intacta, matrizContratoFirmado es un campo distinto, dueño
  // rrpp).
  matrizCiudadResidencia: text('matriz_ciudad_residencia'),
  // Nullable sin default a propósito, mismo criterio que
  // ingresoServicioSubtipoCrudo: "pendiente de RRPP" es el estado real
  // hasta que alguien lo llena.
  matrizEstadoReunion: estadoReunionEnum('matriz_estado_reunion'),
  // Antes texto libre ("temporal", sin FK a `usuarios`) — el negocio
  // cerró la lista a las dos personas reales que hoy llevan cuentas acá,
  // mismo criterio que el resto de los campos cerrados de este archivo
  // (ver PROPIETARIOS_MATRIZ_INGRESO en schema/enums.ts).
  matrizPropietario: propietarioMatrizIngresoEnum('matriz_propietario'),
  matrizContratoFirmado: boolean('matriz_contrato_firmado').notNull().default(false),
  matrizBienvenidaGenerada: boolean('matriz_bienvenida_generada').notNull().default(false),
  matrizLinkResumen: text('matriz_link_resumen'),
  matrizDiagnosticoGenerado: boolean('matriz_diagnostico_generado').notNull().default(false),
  matrizLinkDiagnostico: text('matriz_link_diagnostico'),
  matrizIngresoGenerado: boolean('matriz_ingreso_generado').notNull().default(false),
  matrizFechaReunionCreativa: date('matriz_fecha_reunion_creativa'),
  // Array de texto libre — mismo criterio que objetivoComercial arriba:
  // el negocio dio ejemplos ilustrativos ("Feria, Conferencias,
  // Impresión"), no una lista cerrada.
  matrizVentaCruzada: text('matriz_venta_cruzada').array(),
  matrizObservacionesComerciales: text('matriz_observaciones_comerciales'),

  // "Proceso de Lanzamiento y Promoción" — Área exclusiva de RRPP, Fase
  // 1 (junto a Ficha Editorial/Matriz de Ingreso), NO la Sección 7
  // "Lanzamiento y promoción" de más abajo (lanzamientoEstatus/
  // nivelSatisfaccion/fichaLanzamientoReuniones, alcanzable solo vía
  // pasoActivo=7 en el stepper — que RRPP ya no ve, ver el comentario en
  // ProyectoDetallePage.tsx). Prefijo `lanzamientoPromocion` a propósito
  // para no chocar con esas columnas `lanzamiento*` existentes, aunque
  // el nombre de la sección se parezca. Reuniones fijas (primera/
  // segunda), no una tabla de varias filas como fichaLanzamientoReuniones
  // — el negocio pidió columnas puntuales, no un registro abierto.
  lanzamientoPromocionFechaPrimeraReunion: date('lanzamiento_promocion_fecha_primera_reunion'),
  // Cerrado a Paola Morales/Daniel Valente — a pedido explícito del
  // negocio, mismas dos personas y mismo enum que
  // fichasTrazabilidad.matrizPropietario (propietarioMatrizIngresoEnum,
  // ver schema/enums.ts): se reutiliza en vez de duplicar un enum
  // idéntico con otro nombre.
  lanzamientoPromocionEncargadoPrimeraReunion: propietarioMatrizIngresoEnum('lanzamiento_promocion_encargado_primera_reunion'),
  lanzamientoPromocionPuntosTratadosPrimera: text('lanzamiento_promocion_puntos_tratados_primera'),
  lanzamientoPromocionFechaSegundaReunion: date('lanzamiento_promocion_fecha_segunda_reunion'),
  lanzamientoPromocionEncargadoSegundaReunion: propietarioMatrizIngresoEnum('lanzamiento_promocion_encargado_segunda_reunion'),
  lanzamientoPromocionAcuerdosSegunda: text('lanzamiento_promocion_acuerdos_segunda'),
  lanzamientoPromocionObjetivoComercial: text('lanzamiento_promocion_objetivo_comercial'),
  // Cerrado a Sí/No/Pendiente — tres valores explícitos dados por el
  // negocio, ver PARTICIPACION_FERIAS en schema/enums.ts.
  lanzamientoPromocionParticipacionFerias: participacionFeriasEnum('lanzamiento_promocion_participacion_ferias'),
  // Texto libre en la base (no un enum de ~195 países: mantenerlo
  // sincronizado con ALTER TYPE ... ADD VALUE no aporta nada acá) — a
  // pedido explícito del negocio, el frontend sí lo presenta como un
  // <select> con el listado completo de países (ver
  // SeccionLanzamientoPromocion.tsx), mismo patrón que tonoEstilo/
  // publicoEdad: sugerencia cerrada en la UI, columna abierta en la base.
  lanzamientoPromocionIsbn: text('lanzamiento_promocion_isbn'),
  lanzamientoPromocionDetallesProyeccion: text('lanzamiento_promocion_detalles_proyeccion'),
  lanzamientoPromocionFechaTentativa: date('lanzamiento_promocion_fecha_tentativa'),
  // Texto libre sin <select> de sugerencias: a diferencia de
  // Encargado/tonoEstilo arriba, acá el negocio no dio ni un solo
  // ejemplo de valor real ("Tipo de Lanzamiento (select)", sin
  // opciones) — no hay nada con qué sugerir sin inventar categorías.
  lanzamientoPromocionTipo: text('lanzamiento_promocion_tipo'),
  lanzamientoPromocionObservaciones: text('lanzamiento_promocion_observaciones'),
  lanzamientoPromocionObservacionesGenerales: text('lanzamiento_promocion_observaciones_generales'),
  lanzamientoPromocionLinkMinuta: text('lanzamiento_promocion_link_minuta'),

  // "Matriz de Asesorías con fechas" — módulo de RRPP, mismo lugar que
  // Matriz de Ingreso (/proyectos/:id/ficha-trazabilidad, ver FichaTrazabilidadPage.tsx
  // en el frontend, debajo de <SeccionMatrizIngreso>). Prefijo `asesoria`
  // — ver el comentario completo en schema/enums.ts (evita choques con
  // nivelSatisfaccion/impresionResponsable/matrizContratoFirmado, que ya
  // existen con otro dueño en este mismo archivo). LIBRO (posibleTituloLibro,
  // Ficha Editorial) se muestra de solo lectura en la cabecera de esta
  // sección — no se duplica acá.
  asesoriaEstado: asesoriaEstadoEnum('asesoria_estado'),
  // Texto libre con <select> de sugerencias en el frontend — el negocio
  // solo dio un nombre real ('Manuela Traettino'), no una nómina
  // cerrada, mismo criterio que lanzamientoPromocionEncargado* antes de
  // que el negocio confirmara la lista completa (ver el historial de
  // esa sección).
  asesoriaEspecialistaResponsable: text('asesoria_especialista_responsable'),
  asesoriaFechaPrimeraReunion: date('asesoria_fecha_primera_reunion'),
  asesoriaFechaSegundaReunion: date('asesoria_fecha_segunda_reunion'),
  asesoriaFechaAdicional: date('asesoria_fecha_adicional'),
  // Texto libre en la base — mismo criterio que lanzamientoPromocionIsbn:
  // el frontend lo presenta como <select> con el listado completo de
  // países (ver paises.ts), sin forzar un enum de ~195 valores acá.
  asesoriaIsbnPais: text('asesoria_isbn_pais'),
  asesoriaNivelSatisfaccion: asesoriaNivelSatisfaccionEnum('asesoria_nivel_satisfaccion'),
  asesoriaFase: asesoriaFaseEnum('asesoria_fase'),
  asesoriaFechaSugeridaGe: date('asesoria_fecha_sugerida_ge'),
  asesoriaFechaPautadaAutor: date('asesoria_fecha_pautada_autor'),
  asesoriaFeriaProyectada: asesoriaFeriaProyectadaEnum('asesoria_feria_proyectada'),
  asesoriaNotas: text('asesoria_notas'),
  asesoriaLinkMinutaGerencia: text('asesoria_link_minuta_gerencia'),
  asesoriaRutaPromocionEnviada: boolean('asesoria_ruta_promocion_enviada').notNull().default(false),
  asesoriaLinkRutaPromocion: text('asesoria_link_ruta_promocion'),
  asesoriaFuturoAutor: asesoriaFuturoAutorEnum('asesoria_futuro_autor'),
  asesoriaInfoFeriaEnviada: boolean('asesoria_info_feria_enviada').notNull().default(false),
  // Booleano (Mapeado de Sí/No en el frontend) — mismo criterio que
  // ingresoServicioAlianza/matrizContratoFirmado: "Sí"/"No" de texto
  // libre no se puede filtrar de forma confiable.
  asesoriaParticipacionFeria: boolean('asesoria_participacion_feria').notNull().default(false),
  asesoriaFeriaAParticipar: asesoriaFeriaAParticiparEnum('asesoria_feria_a_participar'),
  asesoriaCotizacionImpresion: boolean('asesoria_cotizacion_impresion').notNull().default(false),
  asesoriaResponsableImpresion: asesoriaResponsableImpresionEnum('asesoria_responsable_impresion'),
  asesoriaFechaCotizacionSolicitada: date('asesoria_fecha_cotizacion_solicitada'),
  asesoriaFechaCotizacionEnviada: date('asesoria_fecha_cotizacion_enviada'),
  asesoriaCotizacionAceptada: boolean('asesoria_cotizacion_aceptada').notNull().default(false),
  asesoriaDistribucionAceptada: boolean('asesoria_distribucion_aceptada').notNull().default(false),
  asesoriaResponsableDistribucion: asesoriaResponsableDistribucionEnum('asesoria_responsable_distribucion'),
  asesoriaNotaDistribucion: text('asesoria_nota_distribucion'),
  asesoriaFechaContratoEnviado: date('asesoria_fecha_contrato_enviado'),
  asesoriaContratoRecibidoFirmado: boolean('asesoria_contrato_recibido_firmado').notNull().default(false),

  // Sección 2 — Edición de estilo. Estatus/fechas agregados de la
  // sección completa (a cargo del especialista, mismo dueño que
  // Corrección) — coexiste con `capitulos` (fechaEnvioAutor/
  // fechaPautadaFeedback/fechaRespuestaReal), que sigue siendo el
  // detalle por capítulo individual; esto es la vista de conjunto,
  // mismo criterio que disenoBriefCreativo conviviendo con
  // fichaDisenoPropuestas más abajo. estatus queda como texto libre a
  // propósito, mismo motivo que el resto del archivo: el conjunto
  // cerrado de valores todavía no está confirmado como enum.
  edicionEstatus: text('edicion_estatus'),
  edicionFechaEnvioEditor: date('edicion_fecha_envio_editor'),
  edicionFechaRecepcionEditor: date('edicion_fecha_recepcion_editor'),
  edicionFechaEnvioAutor: date('edicion_fecha_envio_autor'),
  edicionFechaAprobacionAutor: date('edicion_fecha_aprobacion_autor'),
  edicionObservaciones: text('edicion_observaciones'),

  // Sección 3 — Corrección. El texto libre queda tal cual (los 30-40
  // criterios individuales del documento real no se modelan — el
  // corrector es freelance y nunca los llena él mismo en el sistema).
  // fechaEntrega/aprobado sí son estructurados: el documento real los
  // trae por cada una de las tres categorías. aprobado es boolean
  // nullable (null = pendiente), mismo patrón que fichaCalidadFases.aprobado.
  correccionTripaCompleta: text('correccion_tripa_completa'),
  correccionTripaCompletaFechaEntrega: date('correccion_tripa_completa_fecha_entrega'),
  correccionTripaCompletaAprobado: boolean('correccion_tripa_completa_aprobado'),
  correccionPreliminares: text('correccion_preliminares'),
  correccionPreliminaresFechaEntrega: date('correccion_preliminares_fecha_entrega'),
  correccionPreliminaresAprobado: boolean('correccion_preliminares_aprobado'),
  correccionCubiertaExtendida: text('correccion_cubierta_extendida'),
  correccionCubiertaExtendidaFechaEntrega: date('correccion_cubierta_extendida_fecha_entrega'),
  correccionCubiertaExtendidaAprobado: boolean('correccion_cubierta_extendida_aprobado'),

  // Sección 3 (parte 2) — Corrección, estatus agregado que conecta con
  // la matriz de tiempos de jefatura (seguimiento_fases.ts): mismo
  // criterio que edicionEstatus/etc. en Sección 2 — convive con
  // tripa/preliminares/cubierta de arriba (ese detalle de aprobación
  // por categoría no cambia), esto es la vista de conjunto de la fase.
  correccionEstatus: text('correccion_estatus'),
  correccionTipoAsignacion: text('correccion_tipo_asignacion'),
  correccionFechaEnvio: date('correccion_fecha_envio'),
  correccionFechaInicio: date('correccion_fecha_inicio'),
  correccionFechaEntrega: date('correccion_fecha_entrega'),
  correccionTotalDias: numeric('correccion_total_dias', { precision: 6, scale: 2 }),
  correccionObservaciones: text('correccion_observaciones'),

  // Sección 4 — Diseño (solo el brief; las propuestas de portada están
  // en fichaDisenoPropuestas más abajo, una fila por propuesta). Campos
  // confirmados contra la matriz real de Dirección Creativa.
  // disenoBriefAprobadoFecha: la presencia de fecha ya es la aprobación
  // — no hay un booleano/estado separado, la matriz real solo registra
  // la fecha.
  disenoBriefCreativo: text('diseno_brief_creativo'),
  disenoTipoPortada: tipoPortadaEnum('diseno_tipo_portada'),
  disenoFechaReunionCreativa: date('diseno_fecha_reunion_creativa'),
  disenoFechaEntregaBrief: date('diseno_fecha_entrega_brief'),
  disenoBriefAprobadoFecha: date('diseno_brief_aprobado_fecha'),

  // Sección 4 (parte 2) — Diseño, estatus agregado (macro) que conecta
  // con la matriz de tiempos de jefatura — mismo criterio que
  // edicionEstatus/correccionEstatus. Convive con el brief de arriba y
  // con fichaDisenoPropuestas (más abajo, una fila por propuesta): esto
  // es la vista de conjunto de la fase, no reemplaza ninguna de las dos.
  disenoEstatus: text('diseno_estatus'),
  disenoFechaInicio: date('diseno_fecha_inicio'),
  disenoFechaEntrega: date('diseno_fecha_entrega'),
  disenoTotalDias: numeric('diseno_total_dias', { precision: 6, scale: 2 }),
  disenoObservaciones: text('diseno_observaciones'),

  // Sección 5 (parte 2) — Calidad, estatus agregado (macro) que conecta
  // con la matriz de tiempos de jefatura — mismo criterio que
  // edicionEstatus/correccionEstatus/disenoEstatus. Convive con
  // fichaCalidadFases (más abajo, una fila por fase de validación): esto
  // es la vista de conjunto de la fase, no la reemplaza.
  calidadEstatus: text('calidad_estatus'),
  calidadFechaInicio: date('calidad_fecha_inicio'),
  calidadFechaEntrega: date('calidad_fecha_entrega'),
  calidadTotalDias: numeric('calidad_total_dias', { precision: 6, scale: 2 }),
  calidadObservaciones: text('calidad_observaciones'),

  // Sección 6 — Soporte digital.
  soporteDigitalCuentaAmazon: text('soporte_digital_cuenta_amazon'),
  soporteDigitalFechaEnvioFormulario: date('soporte_digital_fecha_envio_formulario'),
  soporteDigitalFechaActivacion: date('soporte_digital_fecha_activacion'),

  // Sección 6 (parte 2) — Soporte digital, estatus agregado (macro) que
  // conecta con la matriz de tiempos de jefatura — mismo criterio que
  // edicionEstatus/correccionEstatus/disenoEstatus/calidadEstatus.
  // Convive con cuentaAmazon/fechaEnvioFormulario/fechaActivacion de
  // arriba: esto es la vista de conjunto de la fase, no la reemplaza.
  digitalEstatus: text('digital_estatus'),
  digitalFechaInicio: date('digital_fecha_inicio'),
  digitalFechaEntrega: date('digital_fecha_entrega'),
  digitalTotalDias: numeric('digital_total_dias', { precision: 6, scale: 2 }),
  digitalObservaciones: text('digital_observaciones'),

  // Sección 7 — Lanzamiento y promoción (parte general; las reuniones
  // están en fichaLanzamientoReuniones más abajo).
  // TODO (Regla de negocio no confirmada): Tipo de dato exacto. Temporalmente texto libre para evitar bloqueos.
  nivelSatisfaccion: text('nivel_satisfaccion'),

  // Sección 7 (parte 2) — Lanzamiento, estatus agregado (macro) que
  // conecta con la matriz de tiempos de jefatura — mismo criterio que
  // edicionEstatus/correccionEstatus/disenoEstatus/calidadEstatus/
  // digitalEstatus. Convive con nivelSatisfaccion y las reuniones de
  // arriba: esto es la vista de conjunto de la fase, no las reemplaza.
  lanzamientoEstatus: text('lanzamiento_estatus'),
  lanzamientoFechaInicio: date('lanzamiento_fecha_inicio'),
  lanzamientoFechaEntrega: date('lanzamiento_fecha_entrega'),
  lanzamientoTotalDias: numeric('lanzamiento_total_dias', { precision: 6, scale: 2 }),
  lanzamientoObservaciones: text('lanzamiento_observaciones'),

  // Sección 8 — Impresión.
  impresionDeseaCotizacion: boolean('impresion_desea_cotizacion'),
  impresionResponsable: text('impresion_responsable'),
  impresionEstadoCotizacion: estadoCotizacionImpresionEnum('impresion_estado_cotizacion'),
  impresionNotas: text('impresion_notas'),

  // Sección 8 (parte 2) — Impresión, estatus agregado (macro) que
  // conecta con la matriz de tiempos de jefatura — mismo criterio que
  // edicionEstatus/correccionEstatus/etc. Convive con
  // deseaCotizacion/responsable/estadoCotizacion/notas de arriba: esto
  // es la vista de conjunto de la fase, no la reemplaza. Sin dueño
  // individual (no existe impresionId en proyectos): el acceso sigue
  // siendo por rol (rrpp para editar, rrpp/jefe_area para ver), mismo
  // alcance que ya tenía el resto de esta sección — no hace falta un
  // helper aislado. Calidad/Digital/Lanzamiento/Distribución perdieron
  // su dueño individual (calidadId/digitalId/lanzamientoId/
  // distribucionId) en una ronda posterior y ahora siguen este mismo
  // patrón.
  impresionEstatus: text('impresion_estatus'),
  impresionFechaInicio: date('impresion_fecha_inicio'),
  impresionFechaEntrega: date('impresion_fecha_entrega'),
  impresionTotalDias: numeric('impresion_total_dias', { precision: 6, scale: 2 }),
  impresionObservaciones: text('impresion_observaciones'),

  // Sección 9 (parte 2) — Distribución, estatus agregado (macro) que
  // conecta con la matriz de tiempos de jefatura — mismo criterio que
  // edicionEstatus/correccionEstatus/disenoEstatus/calidadEstatus/
  // digitalEstatus/lanzamientoEstatus. Convive con fichaDistribucionPaises
  // (más abajo, una fila por país): esto es la vista de conjunto de la
  // fase, no la reemplaza. "8. Distribución" en el stepper del frontend
  // — la numeración "Sección 9" es interna del schema (Impresión, arriba,
  // no tiene paso propio en el stepper todavía).
  distribucionEstatus: text('distribucion_estatus'),
  distribucionFechaInicio: date('distribucion_fecha_inicio'),
  distribucionFechaEntrega: date('distribucion_fecha_entrega'),
  distribucionTotalDias: numeric('distribucion_total_dias', { precision: 6, scale: 2 }),
  distribucionObservaciones: text('distribucion_observaciones'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Sección 5 — Calidad: cuatro fases de validación fijas, cada una con
// su propia versión de PDF.
export const fichaCalidadFases = pgTable(
  'ficha_calidad_fases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fichaId: uuid('ficha_id')
      .notNull()
      .references(() => fichasTrazabilidad.id, { onDelete: 'cascade' }),
    numeroFase: integer('numero_fase').notNull(),
    pdfUrl: text('pdf_url'),
    pdfVersion: text('pdf_version'),
    fecha: date('fecha'),
    aprobado: boolean('aprobado'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    fichaFaseUnica: unique('ficha_calidad_fases_ficha_numero_unique').on(table.fichaId, table.numeroFase),
    numeroFaseValido: check('ficha_calidad_fases_numero_valido', sql`${table.numeroFase} between 1 and 4`),
  }),
);

// Sección 4 (parte 2) — Diseño: propuestas de portada presentadas.
// descripcion/enlace son Observaciones/Link de presentación, sin
// cambios. `estado` queda como texto libre a propósito — el conjunto
// completo de valores posibles (ej. "aprobadas"/"rechazadas") todavía
// no está confirmado, no forzar un enum cerrado antes de tiempo.
export const fichaDisenoPropuestas = pgTable('ficha_diseno_propuestas', {
  id: uuid('id').primaryKey().defaultRandom(),
  fichaId: uuid('ficha_id')
    .notNull()
    .references(() => fichasTrazabilidad.id, { onDelete: 'cascade' }),
  fechaEnviadaEspecialista: date('fecha_enviada_especialista'),
  fechaEnviadaAutor: date('fecha_enviada_autor'),
  fechaAprobadaAutor: date('fecha_aprobada_autor'),
  estado: text('estado'),
  descripcion: text('descripcion'),
  enlace: text('enlace'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Sección 7 — Lanzamiento y promoción: reuniones con el autor.
export const fichaLanzamientoReuniones = pgTable('ficha_lanzamiento_reuniones', {
  id: uuid('id').primaryKey().defaultRandom(),
  fichaId: uuid('ficha_id')
    .notNull()
    .references(() => fichasTrazabilidad.id, { onDelete: 'cascade' }),
  fecha: date('fecha'),
  puntosTratados: text('puntos_tratados'),
  acuerdos: text('acuerdos'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Sección 9 — Distribución: países acordados y su porcentaje de
// regalías. `pais` identifica la fila (no tiene sentido una fila de
// distribución sin país), el porcentaje puede quedar pendiente.
export const fichaDistribucionPaises = pgTable(
  'ficha_distribucion_paises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fichaId: uuid('ficha_id')
      .notNull()
      .references(() => fichasTrazabilidad.id, { onDelete: 'cascade' }),
    pais: text('pais').notNull(),
    porcentajeRegalias: numeric('porcentaje_regalias', { precision: 5, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fichaPaisUnico: unique('ficha_distribucion_paises_ficha_pais_unique').on(table.fichaId, table.pais),
  }),
);