import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ErrorFichaViva } from '../helpers/fichaViva.js';
import { obtenerCommandCenter, registrarAvanceProyecto, guardarDatosEditoriales } from '../helpers/projectCommandCenter.js';

const params = z.object({ proyectoId: z.string().uuid() });
const avance = z.object({ texto: z.string().trim().min(10).max(2000) }).strict();
export async function projectCommandCenterRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireRole('especialista', 'jefe_area')];
  app.patch('/:proyectoId/datos-editoriales', {preHandler}, async (req,reply) => {
    try { const {proyectoId}=params.parse(req.params); const datos=z.object({titulo:z.string().trim().min(1).max(300).nullable(),subtitulo:z.string().trim().min(1).max(300).nullable()}).strict().parse(req.body); return await guardarDatosEditoriales(proyectoId,datos,req.user!); }
    catch(e) {if(e instanceof ErrorFichaViva)return reply.code(e.status).send({error:e.message});if(e instanceof z.ZodError)return reply.code(400).send({error:'Títulos inválidos'});throw e;}
  });
  app.get('/:proyectoId/command-center', { preHandler }, async (req, reply) => {
    try { const { proyectoId } = params.parse(req.params); return await obtenerCommandCenter(proyectoId, req.user!); }
    catch (e) { if (e instanceof ErrorFichaViva) return reply.code(e.status).send({ error: e.message }); if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Proyecto inválido' }); throw e; }
  });
  app.post('/:proyectoId/avances', { preHandler }, async (req, reply) => {
    try { const { proyectoId } = params.parse(req.params); const { texto } = avance.parse(req.body); return await registrarAvanceProyecto(proyectoId, texto, req.user!); }
    catch (e) { if (e instanceof ErrorFichaViva) return reply.code(e.status).send({ error: e.message }); if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Escribe un avance de 10 a 2000 caracteres' }); throw e; }
  });
}
