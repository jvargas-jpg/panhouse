import { date, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const autores = pgTable('autores', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  
  // --- NUEVOS CAMPOS DE INGRESO (Alineados a Ficha de Trazabilidad) ---
  nombreArtistico: text('nombre_artistico'),
  nacionalidad: text('nacionalidad'),
  fechaNacimiento: date('fecha_nacimiento'),
  redesSociales: text('redes_sociales'), // Guardado como texto (ej. "Instagram: @user, Twitter: @user")

  email: text('email'),
  telefono: text('telefono'),
  // No cambia de un proyecto a otro del mismo autor, así que vive aquí
  // y no se duplica en la ficha de trazabilidad (sección 1).
  pais: text('pais'),
  // Dato interno de gestión: nunca debe exponerse en respuestas dirigidas al autor.
  relevancia: smallint('relevancia'),
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