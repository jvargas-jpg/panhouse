import { boolean, date, pgTable, primaryKey, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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

  // Jefa de Área asignada al proyecto — a pedido explícito del negocio,
  // reemplaza el bloque de 4 columnas (calidadId/digitalId/lanzamientoId/
  // distribucionId) que existía acá: son 2 personas reales las que se
  // reparten los proyectos entrantes, así que hace falta trackear cuál
  // de las dos "tomó" cada uno — antes jefe_area era solo un rol global
  // sin dueño individual por proyecto. calidadId/digitalId/lanzamientoId/
  // distribucionId se dieron de baja en la misma migración: esas 4
  // secciones (Calidad/Digital/Lanzamiento/Distribución) vuelven a
  // depender solo del rol para editar el control agregado, igual que ya
  // le pasaba a Impresión (ver el comentario de impresionEstatus en
  // schema/trazabilidad.ts) — nunca tuvieron un dueño individual real,
  // era un ownership fabricado para el patrón Macro/Micro que el negocio
  // no pidió mantener.
  jefeAreaId: uuid('jefe_area_id').references(() => users.id, { onDelete: 'set null' }),

  // Legacy: título manual del libro/proyecto. El negocio retiró el
  // campo — ya no hay ningún <input> ni ruta que lo escriba (PATCH
  // /:id/titulo se eliminó junto con él) — a favor del nombre generado
  // automáticamente (autores + codigo, ver más abajo). Se deja la
  // columna sin dropear para no fabricar una migración destructiva
  // sobre datos históricos de proyectos que sí lo tenían; queda nullable,
  // ya inerte para cualquier fila nueva.
  titulo: text('titulo'),

  // Código corto único que identifica al proyecto visualmente en toda
  // la app (listas, detalle) junto con los autores — reemplaza a
  // `titulo` como identificador legible. Se genera en el momento de
  // crear el proyecto (ver generarCodigoCorto en helpers/proyectos.ts),
  // nunca editable después: no tiene el problema de ambigüedad de un
  // título libre (dos proyectos con el mismo nombre), y no depende de
  // que rrpp lo complete manualmente más tarde como pasaba con titulo.
  codigo: text('codigo').notNull().unique(),

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

  // Ciclo de aprobación de portada (Portal del Autor): especialista o
  // disenador suben la propuesta (PATCH /:id/propuesta-portada, dueño
  // interno) y el autor la aprueba o pide cambios (PATCH
  // /:id/decision-portada, dueño autor — ver helpers/portalAutor.ts).
  // Viven en proyectos, no en fichaDisenoPropuestas (que ya modela
  // múltiples propuestas internas con su propio ciclo especialista↔autor
  // interno): esto es deliberadamente una superficie aparte y más
  // angosta, la única propuesta "activa" que ve el cliente en su portal,
  // mismo criterio que manuscritoUrl más arriba.
  propuestaPortadaUrl: text('propuesta_portada_url'),
  // varchar (no un pgEnum) a propósito, como pidió el negocio — los tres
  // valores permitidos ('pendiente' | 'aprobada' | 'rechazada') se
  // validan en la capa Zod de las rutas, no en la base de datos.
  portadaDecisionAutor: varchar('portada_decision_autor', { length: 20 }).notNull().default('pendiente'),
  portadaFeedback: text('portada_feedback'),

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

// Tabla de unión para coautoría (Muchos-a-Muchos): un proyecto puede
// tener varios autores, un autor puede figurar en varios proyectos.
// proyectos.autorId (arriba) sigue existiendo a propósito — es la
// primera etapa de una migración aditiva, no un reemplazo: el resto del
// sistema (control de acceso del Portal del Autor, riesgo, carga,
// pagos, seguimiento) sigue leyendo esa columna sin cambios. Cada
// proyecto se crea con al menos una fila acá (ver crearProyecto en
// helpers/proyectos.ts, que además de escribir autorId inserta la fila
// correspondiente en esta tabla).
export const proyectosAutores = pgTable(
  'proyectos_autores',
  {
    // cascade: si se elimina el proyecto, sus filas de coautoría no
    // deben sobrevivir huérfanas — mismo criterio que fichasTrazabilidad
    // (ver schema/trazabilidad.ts) y el resto de tablas hijas de proyectos.
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    // restrict: mismo criterio que proyectos.autorId — no se puede
    // eliminar un autor que sigue vinculado a un proyecto (ver
    // eliminarAutor en helpers/autores.ts).
    autorId: uuid('autor_id')
      .notNull()
      .references(() => autores.id, { onDelete: 'restrict' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.proyectoId, table.autorId] }),
  }),
);
