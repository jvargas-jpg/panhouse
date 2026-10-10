import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { datosDocumentalesSchema, ErrorFichaViva, expedienteFichaViva, guardarDatosDocumentales, historialFicha, resumenFichaViva, ROLES_FICHA_VIVA, verificarAccesoFichaViva } from '../helpers/fichaViva.js';
const paramsSchema = z.object({ proyectoId: z.string().uuid() });
const patchParamsSchema = paramsSchema.extend({ area: z.enum(['proyecto', 'edicion', 'correccion', 'diseno', 'calidad', 'digital', 'lanzamiento', 'impresion', 'distribucion']) });
const historySchema = z.object({ cursor: z.string().max(500).optional() }).strict();
function fail(error: unknown, reply: FastifyReply) {
    if (error instanceof ErrorFichaViva)
        return reply.code(error.status).send({ error: error.message });
    if (error instanceof z.ZodError)
        return reply.code(400).send({ error: 'Datos de expediente inválidos' });
    reply.log.error({ err: error }, 'No se pudo consultar la ficha viva');
    return reply.code(500).send({ error: 'No se pudo completar la consulta del expediente' });
}
export async function fichaVivaRoutes(app: FastifyInstance) {
    const preHandler = [requireAuth, requireRole(...ROLES_FICHA_VIVA)];
    app.get('/:proyectoId/resumen', { preHandler }, async (req, reply) => {
        try {
            const { proyectoId } = paramsSchema.parse(req.params);
            const actor = req.user!;
            await verificarAccesoFichaViva(proyectoId, actor);
            return await resumenFichaViva(proyectoId, actor);
        }
        catch (error) {
            return fail(error, reply);
        }
    });
    app.get('/:proyectoId/expediente', { preHandler }, async (req, reply) => {
        try {
            const { proyectoId } = paramsSchema.parse(req.params);
            const actor = req.user!;
            await verificarAccesoFichaViva(proyectoId, actor);
            return await expedienteFichaViva(proyectoId, actor);
        }
        catch (error) {
            return fail(error, reply);
        }
    });
    app.get('/:proyectoId/actividad', { preHandler }, async (req, reply) => {
        try {
            const { proyectoId } = paramsSchema.parse(req.params);
            const { cursor } = historySchema.parse(req.query);
            await verificarAccesoFichaViva(proyectoId, req.user!);
            return await historialFicha(proyectoId, cursor);
        }
        catch (error) {
            return fail(error, reply);
        }
    });
    app.patch('/:proyectoId/documental/:area', { preHandler }, async (req, reply) => {
        try {
            const { proyectoId, area } = patchParamsSchema.parse(req.params);
            const { datos } = datosDocumentalesSchema.parse(req.body);
            return await guardarDatosDocumentales(proyectoId, area, datos, req.user!);
        }
        catch (error) {
            return fail(error, reply);
        }
    });
}
