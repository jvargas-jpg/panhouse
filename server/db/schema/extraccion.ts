import { boolean, date, index, integer, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { proyectos } from './proyectos.js';
import { users } from './users.js';

// Cronograma de extracciones (Escritura Fantasma): sub-paso de Preparación
// Inicial, distinto de la reunión operativa — ver server/helpers/projectGuide.ts.
// Una fila por sesión programada (numero 1, 2, 3...); el Editor NO se guarda
// aquí — se deriva del Editor asignado al proyecto en Edición (un único
// editor por proyecto, no uno distinto por sesión; ver projectGuide.ts).
export const reunionesExtraccion = pgTable('reuniones_extraccion', {
  id: uuid('id').primaryKey().defaultRandom(),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  // "fecha" queda sin usar (reemplazada por fecha_hora, que combina fecha y
  // hora); no se elimina la columna para no depender del generador
  // interactivo de drizzle-kit por un cambio de nombre/tipo.
  fecha: date('fecha'),
  fechaHora: timestamp('fecha_hora', { withTimezone: true }),
  duracionMinutos: integer('duracion_minutos'),
  realizada: boolean('realizada').notNull().default(false),
  // La sesión siempre es por Meet — lo comparte el Editor (quien la
  // conduce) y lo ve el Autor en su panel ("Tus próximas reuniones").
  meetUrl: text('meet_url'),
  // Material que produce el Editor al conducir la entrevista — nunca el
  // Especialista (ver server/helpers/projectGuide.ts, requisito
  // 'extraction-files' en process.tipo==='edicion'). Se suben a la
  // subcarpeta "Capítulo N" dentro de "Entrevistas" en el Drive del
  // proyecto (ver server/modules/project-workspaces/interviewFolders.ts).
  videoUrl: text('video_url'),
  notasGeminiUrl: text('notas_gemini_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  proyectoNumeroUnico: unique('reuniones_extraccion_proyecto_numero_unique').on(table.proyectoId, table.numero),
}));

// Solicitud de cambio de fecha/hora de una sesión — bidireccional: el
// Editor se la pide al Autor (quien autoriza) y el Autor también puede
// pedírsela al Editor. Nunca se cambia la fecha directamente sin que la
// otra parte lo acepte. Una sola solicitud pendiente por sesión a la vez.
export const reunionExtraccionSolicitudes = pgTable('reunion_extraccion_solicitudes', {
  id: uuid('id').primaryKey().defaultRandom(),
  reunionId: uuid('reunion_id').notNull().references(() => reunionesExtraccion.id, { onDelete: 'cascade' }),
  proyectoId: uuid('proyecto_id').notNull().references(() => proyectos.id, { onDelete: 'cascade' }),
  solicitadoPor: text('solicitado_por').$type<'editor' | 'autor'>().notNull(),
  solicitadoPorUserId: uuid('solicitado_por_user_id').notNull().references(() => users.id),
  fechaHoraPropuesta: timestamp('fecha_hora_propuesta', { withTimezone: true }).notNull(),
  duracionPropuestaMinutos: integer('duracion_propuesta_minutos'),
  motivo: text('motivo'),
  estado: text('estado').$type<'pendiente' | 'aceptada' | 'rechazada'>().notNull().default('pendiente'),
  respondidoEn: timestamp('respondido_en', { withTimezone: true }),
  respondidoPorUserId: uuid('respondido_por_user_id').references(() => users.id),
  respuesta: text('respuesta'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pendienteUnica: uniqueIndex('reunion_extraccion_solicitud_pendiente_unique').on(table.reunionId).where(sql`${table.estado}='pendiente'`),
  porReunion: index('reunion_extraccion_solicitud_reunion_idx').on(table.reunionId, table.createdAt),
}));
