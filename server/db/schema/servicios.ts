import { boolean, check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const servicios = pgTable(
  'servicios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codigo: text('codigo').notNull().unique(), // EF, EEC, EET, SE...
    nombre: text('nombre').notNull(),

    // Servicios con un único plazo (EF, EEC, EET).
    plazoDias: integer('plazo_dias'),

    // Servicios con plazo doble (p. ej. SE): meta interna de gestión vs.
    // compromiso comercial que ve el autor. No modelar como un solo valor
    // con margen: son dos compromisos distintos.
    plazoInternoDias: integer('plazo_interno_dias'),
    plazoComercialDias: integer('plazo_comercial_dias'),

    // Peso de complejidad para ponderar la carga del especialista. Se
    // guarda explícito en vez de derivarlo de los días de plazo porque
    // EEC y EET comparten plazo (150 días) pero tienen orden de
    // complejidad distinto (EF > EEC > EET > SE): los días por sí solos
    // no alcanzan como proxy.
    //
    // Valores de partida (4,3,2,1 en server/db/seed.ts) — el orden
    // EF>EEC>EET>SE está confirmado por el negocio, pero la magnitud
    // exacta de la diferencia no. Ajustar según el piloto si la carga
    // calculada no se siente realista.
    pesoComplejidad: integer('peso_complejidad').notNull(),

    activo: boolean('activo').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Exactamente una de las dos formas de plazo, nunca ambas ni
    // ninguna: refuerza a nivel de esquema lo que server/helpers/
    // cronograma.ts ya asume al leer estos campos.
    plazoUnicoOdoble: check(
      'servicios_plazo_unico_o_doble',
      sql`(${table.plazoDias} is not null and ${table.plazoInternoDias} is null and ${table.plazoComercialDias} is null)
          or
          (${table.plazoDias} is null and ${table.plazoInternoDias} is not null and ${table.plazoComercialDias} is not null)`,
    ),
  }),
);
