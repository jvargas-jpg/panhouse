import type { FastifyReply } from 'fastify';
import type { ZodSchema } from 'zod';

export function parseOrReply<T>(schema: ZodSchema<T>, data: unknown, reply: FastifyReply): T | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.code(400).send({ error: 'Datos inválidos', detalles: result.error.flatten() });
    return undefined;
  }
  return result.data;
}
