import { boolean, date, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { autores } from './autores.js';
import { colecciones, presupuestos, unidades } from './catalogos.js';
import { categoriaStandByEnum, estadoProyectoEnum } from './enums.js';
import { servicios } from './servicios.js';
import { users } from './users.js';

export const proyectos = pgTable('proyectos', {
  id: uuid('id').primaryKey().defaultRandom(),
  autorId: uuid('autor_id')
    .notNull()
    .references(() => autores.id, { onDelete: 'restrict' }),
  servicioId: uuid('servicio_id')
    .notNull()
    .references(() => servicios.id, { onDelete: 'restrict' }),
  unidadId: uuid('unidad_id')
    .notNull()
    .references(() => unidades.id, { onDelete: 'restrict' }),
  coleccionId: uuid('coleccion_id').references(() => colecciones.id, { onDelete: 'set null' }),
  presupuestoId: uuid('presupuesto_id')
    .notNull()
    .references(() => presupuestos.id, { onDelete: 'restrict' }),
  
  // Especialista responsable del proyecto; se usa para ponderar su
  // carga activa (ver server/helpers/carga.ts). Sin asignar hasta que
  // se reparte el trabajo.
  especialistaId: uuid('especialista_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Editor responsable del proyecto — mismo patrón que especialistaId,
  // pero lo asigna jefe_edicion, no jefe_area. Vive a nivel de proyecto
  // (no por capítulo individual): el proceso real es que jefe_edicion
  // reparte el proyecto completo a un editor.
  editorId: uuid('editor_id').references(() => users.id, { onDelete: 'set null' }),

  // --- NUEVOS ROLES (Alineados a Matriz IA) ---
  correctorId: uuid('corrector_id').references(() => users.id, { onDelete: 'set null' }),
  disenadorId: uuid('disenador_id').references(() => users.id, { onDelete: 'set null' }),
  calidadId: uuid('calidad_id').references(() => users.id, { onDelete: 'set null' }),

  // Encargado digital asignado (soporte_digital) — mismo patrón que
  // calidadId: no existía ninguna columna de dueño individual para esta
  // sección hasta ahora (Sección 6 solo tenía puedeEditar por rol, sin
  // ownership). Se agrega para que PATCH /:proyectoId/digital-control
  // tenga contra qué comparar; se asigna desde el mismo panel
  // "Escuadrón de Producción" que el resto de estos roles.
  digitalId: uuid('digital_id').references(() => users.id, { onDelete: 'set null' }),

  // Responsable de lanzamiento asignado — mismo patrón que
  // calidadId/digitalId (nombradas por sección, no por rol) en vez de
  // "rrppId": rrpp es hoy el único rol dueño de la Sección 7, pero el
  // nombre de la columna sigue el criterio más reciente de este bloque.
  lanzamientoId: uuid('lanzamiento_id').references(() => users.id, { onDelete: 'set null' }),

  // Responsable logístico asignado (Distribución) — mismo patrón que
  // calidadId/digitalId/lanzamientoId. Última columna de este bloque:
  // con esta, las ocho fases del stepper tienen su propio dueño
  // individual disponible para el patrón Macro/Micro.
  distribucionId: uuid('distribucion_id').references(() => users.id, { onDelete: 'set null' }),

  // Título del libro. Vive en proyectos (no en la ficha) porque
  // identifica al proyecto igual que autor/servicio — dueño rrpp, mismo
  // rol que el resto de Sección 1 — Perfil, aunque se escribe por una
  // ruta propia (PATCH /:id/titulo) porque esta tabla, no la ficha.
  titulo: text('titulo'),

  // Enlace al manuscrito original (Google Docs, OneDrive, etc.) que el
  // propio autor entrega desde el Portal del Autor — PATCH
  // /:id/manuscrito, dueño autor (el autorId vinculado a la sesión, ver
  // users.autorId). Mismo criterio que el resto de "enlaces" de este
  // sistema (fichaDisenoPropuestas.enlace, pagos.comprobanteUrl): un
  // link externo, no un archivo subido — no existe infraestructura de
  // almacenamiento de archivos.
  manuscritoUrl: text('manuscrito_url'),

  estado: estadoProyectoEnum('estado').notNull().default('en_proceso'),
  
  // Solo aplica cuando estado = 'stand_by'. El proyecto no se pausa
  // formalmente (no genera fila en `pausas`) porque el retorno es
  // breve o hay una exoneración contractual; se guarda como categoría
  // cerrada, nunca como texto libre.
  categoriaStandBy: categoriaStandByEnum('categoria_stand_by'),

  fechaProgramadaInicio: date('fecha_programada_inicio').notNull(),
  // Puede diferir de la fecha programada; se guardan ambas.
  fechaRealInicio: date('fecha_real_inicio'),
  fechaDeseadaAutor: date('fecha_deseada_autor'),

  // --- HITOS DE PROCESO / FECHAS (Alineados a Matriz IA) ---
  fechaFinProyectada: date('fecha_fin_proyectada'),
  fechaProcesoIngreso: date('fecha_proceso_ingreso'),
  fechaExtraccionContenido: date('fecha_extraccion_contenido'),
  fechaCreacionContenido: date('fecha_creacion_contenido'),
  fechaFeedbackTripa: date('fecha_feedback_tripa'),
  fechaAsignacionCorreccion: date('fecha_asignacion_correccion'),
  fechaAsignacionDiseno: date('fecha_asignacion_diseno'),
  fechaTripaDiagramada: date('fecha_tripa_diagramada'),
  fechaAprobacionFinal: date('fecha_aprobacion_final'),

  // --- CONTROL ADMINISTRATIVO (Alineados a Matriz IA) ---
  contratoFirmado: boolean('contrato_firmado').default(false),

  // Cascada de Fase 1 (Inicio): comercial llena los datos de venta y
  // notifica a rrpp (notificadoRrpp) → rrpp completa la ficha de
  // trazabilidad y notifica a jefatura (notificadoJefatura). Dos
  // banderas independientes, no una sola (reemplazan a la antigua
  // fichaEnviada): son dos pasos separados, con dueños distintos, y cada
  // uno necesita su propia idempotencia — sin esto, recargar la pantalla
  // de Fase 1 perdería el estado "Notificado" de cada botón (React no
  // persiste nada por sí solo) y nada impediría notificar dos veces el
  // mismo paso.
  notificadoRrpp: boolean('notificado_rrpp').notNull().default(false),
  notificadoJefatura: boolean('notificado_jefatura').notNull().default(false),
  
  // TODO (Regla de negocio no confirmada): La Matriz IA tiene "Pago Cuota 1" al 6. 
  // Asumo temporalmente que es un booleano (pagado/no pagado). Si el negocio 
  // requiere guardar la *fecha* de pago en su lugar, esto debe cambiar a date().
  pagoCuota1: boolean('pago_cuota_1').default(false),
  pagoCuota2: boolean('pago_cuota_2').default(false),
  pagoCuota3: boolean('pago_cuota_3').default(false),
  pagoCuota4: boolean('pago_cuota_4').default(false),
  pagoCuota5: boolean('pago_cuota_5').default(false),
  pagoCuota6: boolean('pago_cuota_6').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // $onUpdate: Drizzle la refresca en todo db.update(proyectos), sin
  // depender de que cada call site se acuerde de fijarla a mano (mismo
  // patrón que pausas.ts).
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
