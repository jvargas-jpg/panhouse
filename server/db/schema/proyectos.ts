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

  // Título del libro. Vive en proyectos (no en la ficha) porque
  // identifica al proyecto igual que autor/servicio — dueño rrpp, mismo
  // rol que el resto de Sección 1 — Perfil, aunque se escribe por una
  // ruta propia (PATCH /:id/titulo) porque esta tabla, no la ficha.
  titulo: text('titulo'),

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
