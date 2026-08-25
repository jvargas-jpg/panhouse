import { boolean, check, date, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { causaPausaEnum, origenConfirmacionPagoEnum } from './enums.js';
import { proyectos } from './proyectos.js';
import { users } from './users.js';

// Regla de negocio central: toda pausa aquí registrada es, por
// definición, de causa externa al especialista (autor u otro
// departamento). Su duración se excluye del cálculo de desempeño y de
// las alertas de retraso — ver server/helpers/performance.ts.
export const pausas = pgTable(
  'pausas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proyectoId: uuid('proyecto_id')
      .notNull()
      .references(() => proyectos.id, { onDelete: 'cascade' }),
    causa: causaPausaEnum('causa').notNull(),
    responsableId: uuid('responsable_id').references(() => users.id, { onDelete: 'set null' }),
    fechaInicio: timestamp('fecha_inicio', { withTimezone: true }).notNull(),
    fechaFin: timestamp('fecha_fin', { withTimezone: true }),

    // Campos exclusivos del estado PAUSADO (el autor necesita más de un
    // mes): no aplican a una espera corta de tipo "retrasado". El autor
    // debe retomar antes de esta fecha o corresponde recargo de
    // reactivación.
    esPausadoFormal: boolean('es_pausado_formal').notNull().default(false),
    fechaLimiteRetoma: date('fecha_limite_retoma'),
    recargoAplica: boolean('recargo_aplica').notNull().default(false),

    // PAUSADO exige que el proyecto esté pagado en su totalidad. Hoy no
    // existe módulo de cobranzas: se registra como atestación explícita
    // (quién y cuándo la confirmó, o que llegó por webhook del futuro
    // portal de pagos) en vez de validarse contra un saldo real. El
    // guardián de esta regla vive en server/helpers/pausas.ts
    // (validarPausaFormal); el CHECK de abajo es la segunda barrera a
    // nivel de esquema.
    pagoConfirmado: boolean('pago_confirmado').notNull().default(false),
    origenConfirmacionPago: origenConfirmacionPagoEnum('origen_confirmacion_pago'),
    confirmadoPagoPorId: uuid('confirmado_pago_por_id').references(() => users.id, { onDelete: 'set null' }),
    confirmadoPagoEn: timestamp('confirmado_pago_en', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // A diferencia de createdAt, una pausa sí se modifica después de
    // creada (fechaFin, pagoConfirmado, recargoAplica se llenan más
    // tarde). $onUpdate hace que Drizzle la refresque en todo
    // db.update(pausas), sin depender de que cada call site se acuerde
    // de fijarla a mano.
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    pagoConfirmadoRequiereOrigen: check(
      'pausas_pago_confirmado_requiere_origen',
      sql`${table.pagoConfirmado} = false or ${table.origenConfirmacionPago} is not null`,
    ),
  }),
);
