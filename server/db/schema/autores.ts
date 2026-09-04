import { date, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Perfil digital del autor — seis plataformas, todas opcionales (nadie
// tiene por qué usarlas todas). Guardado como jsonb (no seis columnas
// sueltas ni el texto libre anterior "Instagram: @user, Twitter: @user"):
// una sola forma estructurada que el frontend puede editar campo por
// campo (ver CrearAutorForm.tsx) sin parsear texto a mano.
export interface RedesSociales {
  instagram?: string;
  x?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
}

export const autores = pgTable('autores', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),

  // --- NUEVOS CAMPOS DE INGRESO (Alineados a Ficha de Trazabilidad) ---
  nombreArtistico: text('nombre_artistico'),
  nacionalidad: text('nacionalidad'),
  fechaNacimiento: date('fecha_nacimiento'),
  redesSociales: jsonb('redes_sociales').$type<RedesSociales>(),
  // "¿Qué hace el autor y a qué se dedica?" — vive en el autor mismo
  // porque no cambia de un proyecto a otro, mismo criterio que `pais`
  // más abajo (fichasTrazabilidad ya no tiene una copia duplicada de
  // estos dos campos — ver el comentario en schema/trazabilidad.ts).
  //
  // personalidad: array nativo de Postgres (no jsonb, a diferencia de
  // redesSociales) — es una lista plana de rasgos/etiquetas ("Extrovertida",
  // "Directa"), no un objeto con forma fija, así que text[] es el ajuste
  // más simple: CrearAutorForm.tsx la edita como chips, no como texto libre.
  personalidad: text('personalidad').array(),
  ocupacion: text('ocupacion'),

  email: text('email'),
  telefono: text('telefono'),
  // País de ubicación del autor. No cambia de un proyecto a otro del
  // mismo autor, así que vive aquí y no se duplica en la ficha de
  // trazabilidad (sección 1).
  pais: text('pais'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // $onUpdate: Drizzle la refresca en todo db.update(autores), sin
  // depender de que cada call site se acuerde de fijarla a mano (mismo
  // patrón que proyectos.ts y pausas.ts).
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),

  // TODO: campos adicionales de autor por definir.
});