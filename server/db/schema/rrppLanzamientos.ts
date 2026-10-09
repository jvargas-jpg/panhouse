import {
  date,
  index,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { proyectos } from "./proyectos.js";
import { users } from "./users.js";

// Filas repetibles de la Matriz. Autor, libro y fecha de lanzamiento se leen
// del proyecto/Ficha: nunca se copian ni se importan fórmulas entre hojas.
export const rrppEventos = pgTable(
  "rrpp_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proyectoId: uuid("proyecto_id")
      .notNull()
      .references(() => proyectos.id, { onDelete: "cascade" }),
    clientKey: uuid("client_key").notNull(),
    tipo: text("tipo").notNull(),
    estado: text("estado").notNull().default("No iniciada"),
    fase: text("fase"),
    fecha: date("fecha").notNull(),
    hora: time("hora"),
    lugar: text("lugar"),
    responsableId: uuid("responsable_id").references(() => users.id, {
      onDelete: "set null",
    }),
    representanteId: uuid("representante_id").references(() => users.id, {
      onDelete: "set null",
    }),
    rutaActividad: text("ruta_actividad"),
    notasRrss: text("notas_rrss"),
    programas: text("programas"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    instancia: unique("rrpp_eventos_proyecto_client_unique").on(
      t.proyectoId,
      t.clientKey,
    ),
    fecha: index("rrpp_eventos_fecha_idx").on(t.fecha, t.proyectoId),
    proyecto: index("rrpp_eventos_proyecto_idx").on(t.proyectoId),
  }),
);

export const rrppPublicaciones = pgTable(
  "rrpp_publicaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proyectoId: uuid("proyecto_id")
      .notNull()
      .references(() => proyectos.id, { onDelete: "cascade" }),
    clientKey: uuid("client_key").notNull(),
    tipo: text("tipo").notNull(),
    estado: text("estado").notNull().default("Nuevo"),
    estadoPieza: text("estado_pieza"),
    detalles: text("detalles"),
    notas: text("notas"),
    responsableId: uuid("responsable_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    instancia: unique("rrpp_publicaciones_proyecto_client_unique").on(
      t.proyectoId,
      t.clientKey,
    ),
    estado: index("rrpp_publicaciones_estado_idx").on(t.estado, t.proyectoId),
    proyecto: index("rrpp_publicaciones_proyecto_idx").on(t.proyectoId),
  }),
);
