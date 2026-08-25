import { boolean, check, date, integer, numeric, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { proyectos } from './proyectos.js';
import { estadoCotizacionImpresionEnum, tipoPortadaEnum } from './enums.js';

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

  // Sección 1 — Proyecto (perfil del autor y encargo).
  // Datos de contacto y país del autor viven en `autores` (no se
  // duplican aquí); nivel de presupuesto ya existe como
  // proyectos.presupuestoId (catálogo Plata/Oro/Platinium) y tampoco
  // se duplica. Capítulos/páginas aquí son la promesa contractual —
  // no existe hoy un total operativo agregado con el que contrastarla;
  // el avance real por capítulo vive en `capitulos`.
  perfilAutor: text('perfil_autor'),
  publicoObjetivo: text('publico_objetivo'),
  objetivosComerciales: text('objetivos_comerciales'),
  capitulosPactados: integer('capitulos_pactados'),
  paginasPactadas: integer('paginas_pactadas'),

  // Sección 1 (parte 3) — Datos de ingreso, matriz real provista por el
  // orquestador. Todo texto libre salvo las fechas (mismo patrón `date`
  // que el resto del archivo) — ningún valor cerrado (ej. tipo de
  // proyecto) está confirmado todavía como enum.
  ingresoNombreArtistico: text('ingreso_nombre_artistico'),
  ingresoNacionalidad: text('ingreso_nacionalidad'),
  ingresoFechaNacimiento: date('ingreso_fecha_nacimiento'),
  ingresoTipoProyecto: text('ingreso_tipo_proyecto'),
  ingresoTipoProyectoDetalle: text('ingreso_tipo_proyecto_detalle'),
  ingresoFechaIngreso: date('ingreso_fecha_ingreso'),
  ingresoFechaCierre: date('ingreso_fecha_cierre'),
  ingresoFechaDeseada: date('ingreso_fecha_deseada'),
  ingresoTemaGeneral: text('ingreso_tema_general'),
  ingresoServicioPerfil: text('ingreso_servicio_perfil'),
  ingresoServicioEjecucion: text('ingreso_servicio_ejecucion'),
  ingresoServicioAlianza: text('ingreso_servicio_alianza'),
  ingresoServicioPresupuesto: text('ingreso_servicio_presupuesto'),
  ingresoRedesSociales: text('ingreso_redes_sociales'),
  ingresoPersonalidad: text('ingreso_personalidad'),
  ingresoOcupacion: text('ingreso_ocupacion'),
  ingresoObservaciones: text('ingreso_observaciones'),

  // Sección 1 (parte 4) — Datos de ingreso, segunda mitad de la matriz
  // real (Especificaciones del Proyecto): detalles editoriales, público
  // objetivo del libro (distinto del autor) y parámetros técnicos/equipo.
  ingresoPosibleTitulo: text('ingreso_posible_titulo'),
  ingresoColeccion: text('ingreso_coleccion'),
  ingresoPublicoSexo: text('ingreso_publico_sexo'),
  ingresoPublicoEdad: text('ingreso_publico_edad'),
  ingresoPublicoPerfil: text('ingreso_publico_perfil'),
  ingresoPropositoSocial: text('ingreso_proposito_social'),
  ingresoObjetivoComercial: text('ingreso_objetivo_comercial'),
  ingresoTonoEstilo: text('ingreso_tono_estilo'),
  ingresoCriterioExtra: text('ingreso_criterio_extra'),
  ingresoCondicionesEspeciales: text('ingreso_condiciones_especiales'),
  ingresoObservacionesEquipo: text('ingreso_observaciones_equipo'),

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

  // Sección 6 — Soporte digital.
  soporteDigitalCuentaAmazon: text('soporte_digital_cuenta_amazon'),
  soporteDigitalFechaEnvioFormulario: date('soporte_digital_fecha_envio_formulario'),
  soporteDigitalFechaActivacion: date('soporte_digital_fecha_activacion'),

  // Sección 7 — Lanzamiento y promoción (parte general; las reuniones
  // están en fichaLanzamientoReuniones más abajo).
  // TODO (Regla de negocio no confirmada): Tipo de dato exacto. Temporalmente texto libre para evitar bloqueos.
  nivelSatisfaccion: text('nivel_satisfaccion'),

  // Sección 8 — Impresión.
  impresionDeseaCotizacion: boolean('impresion_desea_cotizacion'),
  impresionResponsable: text('impresion_responsable'),
  impresionEstadoCotizacion: estadoCotizacionImpresionEnum('impresion_estado_cotizacion'),
  impresionNotas: text('impresion_notas'),

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