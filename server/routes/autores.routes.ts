import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { autores } from '../db/schema/index.js';
import { eliminarAutor, listarAutoresSinProyecto } from '../helpers/autores.js';
import { parseOrReply } from '../helpers/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

// Ejemplo mínimo de recurso protegido por rol, usado también como base
// para los tests de RBAC. Los roles con acceso a esta lista interna de
// autores se ajustarán cuando se definan los permisos reales del módulo.
const ROLES_LECTURA_AUTORES = ['comercial', 'rrpp', 'jefe_area', 'direccion'] as const;
const ROLES_ESCRITURA_AUTORES = ['comercial', 'direccion'] as const;

const autorIdParamSchema = z.object({ id: z.string().uuid() });

// Perfil digital — seis plataformas opcionales, ver RedesSociales en
// server/db/schema/autores.ts. .strict() a propósito: sin esto, un
// typo de plataforma ("snapchap") se guardaría en silencio en vez de
// avisar, ya que Zod descarta claves desconocidas por defecto. Mismo
// objeto (sin nullable por dentro: una plataforma vacía se omite, no se
// manda como null) para crear y editar; lo que sí difiere entre los dos
// schemas es si el objeto completo puede ser null (ver editarAutorSchema
// más abajo).
const redesSocialesSchema = z
  .object({
    instagram: z.string().optional(),
    x: z.string().optional(),
    facebook: z.string().optional(),
    linkedin: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
  })
  .strict();

// Solo dígitos, "+" inicial opcional, guiones y espacios — bloquea
// alfabéticos y símbolos raros a nivel de servidor (fuente de verdad;
// CrearAutorForm.tsx ya filtra lo mismo en el input, pero eso es UX, no
// la validación real). Compartido entre crear y editar para no repetir
// el regex/mensaje dos veces.
const telefonoSchema = z.string().regex(/^\+?[0-9\s-]+$/, 'Solo se permiten números');

const crearAutorSchema = z.object({
  nombre: z.string().min(1),
  nombreArtistico: z.string().optional(),
  nacionalidad: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  redesSociales: redesSocialesSchema.optional(),
  personalidad: z.array(z.string()).optional(),
  ocupacion: z.string().optional(),
  email: z.string().email().optional(),
  telefono: telefonoSchema.optional(),
  pais: z.string().optional(),
});

// nullable (a diferencia de crearAutorSchema): a diferencia de crear,
// donde un campo vacío simplemente se omite, editar necesita poder
// borrar un valor que ya existía (ej. corregir un correo mal escrito a
// vacío) — mismo patrón nullable().optional() que las secciones de
// fichas_trazabilidad.
const editarAutorSchema = z
  .object({
    nombre: z.string().min(1).optional(),
    nombreArtistico: z.string().nullable().optional(),
    nacionalidad: z.string().nullable().optional(),
    fechaNacimiento: z.string().nullable().optional(),
    redesSociales: redesSocialesSchema.nullable().optional(),
    personalidad: z.array(z.string()).nullable().optional(),
    ocupacion: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    telefono: telefonoSchema.nullable().optional(),
    pais: z.string().nullable().optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'No se recibió ningún campo válido para actualizar',
  });

export async function autoresRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [requireAuth, requireRole(...ROLES_LECTURA_AUTORES)] },
    async (_request, reply) => {
      // Más reciente primero — mismo criterio de orden que el resto de
      // listados del CRM (ver listarTodosLosProyectos en helpers/proyectos.ts).
      const lista = await db.select().from(autores).orderBy(desc(autores.createdAt));
      return reply.send({ autores: lista });
    },
  );

  // Pantalla "Autores sin proyecto" de jefe_area: punto de partida del
  // flujo crear-proyecto + asignar-especialista. Solo jefe_area la usa
  // hoy; se amplía por rol si otro lo necesita más adelante.
  app.get(
    '/sin-proyecto',
    { preHandler: [requireAuth, requireRole('jefe_area')] },
    async (_request, reply) => {
      const lista = await listarAutoresSinProyecto();
      return reply.send({ autores: lista });
    },
  );

  app.post(
    '/',
    { preHandler: [requireAuth, requireRole(...ROLES_ESCRITURA_AUTORES)] },
    async (request, reply) => {
      const body = parseOrReply(crearAutorSchema, request.body, reply);
      if (!body) return;

      const [autor] = await db.insert(autores).values(body).returning();
      return reply.code(201).send({ autor });
    },
  );

  // Corregir un dato mal escrito al crear (ej. correo, teléfono) —
  // mismos roles de escritura que la creación.
  app.patch(
    '/:id',
    { preHandler: [requireAuth, requireRole(...ROLES_ESCRITURA_AUTORES)] },
    async (request, reply) => {
      const params = parseOrReply(autorIdParamSchema, request.params, reply);
      if (!params) return;
      const body = parseOrReply(editarAutorSchema, request.body, reply);
      if (!body) return;

      const [autor] = await db.update(autores).set(body).where(eq(autores.id, params.id)).returning();
      if (!autor) return reply.code(404).send({ message: 'Autor no encontrado' });

      return reply.send({ autor });
    },
  );

  // Validación crítica: un autor con proyectos asociados no se borra
  // (400 legible), ni siquiera en cascada — mismos roles de escritura
  // que crear/editar.
  app.delete(
    '/:id',
    { preHandler: [requireAuth, requireRole(...ROLES_ESCRITURA_AUTORES)] },
    async (request, reply) => {
      const params = parseOrReply(autorIdParamSchema, request.params, reply);
      if (!params) return;

      const resultado = await eliminarAutor(params.id);
      if (!resultado.ok) {
        return reply.code(resultado.status).send({ error: resultado.error });
      }
      return reply.send({ ok: true });
    },
  );
}
