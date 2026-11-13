import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ErrorFichaViva } from '../helpers/fichaViva.js';
import { obtenerCommandCenter, registrarAvanceProyecto, guardarDatosEditoriales } from '../helpers/projectCommandCenter.js';

const params = z.object({ proyectoId: z.string().uuid() });
const avance = z.object({ texto: z.string().trim().min(10).max(2000) }).strict();
export async function projectCommandCenterRoutes(app: FastifyInstance) {
  app.post('/:proyectoId/workflow/continue', { preHandler: [requireAuth, requireRole('especialista')] }, async (req, reply) => {
    try {
      const { proyectoId } = params.parse(req.params);
      const { path } = z.object({ path: z.string().min(1).max(80) }).strict().parse(req.body);
      const data = await obtenerCommandCenter(proyectoId, req.user!);
      const current = data.guide?.paths.find(p => p.id === path);
      if (!current?.canContinue) return reply.code(409).send({ error: 'Completa los requisitos o espera al responsable antes de continuar.', requirements: current?.requirements ?? [] });
      return { nextProcess: data.guide!.paths.find(p => p.id !== path && p.canOperate)?.id ?? path, guide: data.guide };
    } catch (e) { if (e instanceof ErrorFichaViva) return reply.code(e.status).send({ error: e.message }); if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Paso inválido' }); throw e; }
  });
  const preHandler = [requireAuth, requireRole('especialista', 'jefe_area', 'rrpp')];
  // Lectura del centro de proyecto: Admin entra con visión transversal de
  // solo lectura (sin registrar-avance ni editar títulos, ver abajo).
  const lectura = [requireAuth, requireRole('especialista', 'jefe_area', 'rrpp', 'admin')];
  app.patch('/:proyectoId/datos-editoriales', {preHandler}, async (req,reply) => {
    try { const {proyectoId}=params.parse(req.params); const datos=z.object({titulo:z.string().trim().min(1).max(300).nullable(),subtitulo:z.string().trim().min(1).max(300).nullable()}).strict().parse(req.body); return await guardarDatosEditoriales(proyectoId,datos,req.user!); }
    catch(e) {if(e instanceof ErrorFichaViva)return reply.code(e.status).send({error:e.message});if(e instanceof z.ZodError)return reply.code(400).send({error:'Títulos inválidos'});throw e;}
  });
  app.get('/:proyectoId/command-center', { preHandler: lectura }, async (req, reply) => {
    try { const { proyectoId } = params.parse(req.params); return await obtenerCommandCenter(proyectoId, req.user!); }
    catch (e) { if (e instanceof ErrorFichaViva) return reply.code(e.status).send({ error: e.message }); if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Proyecto inválido' }); throw e; }
  });
  app.post('/:proyectoId/avances', { preHandler }, async (req, reply) => {
    try { const { proyectoId } = params.parse(req.params); const { texto } = avance.parse(req.body); return await registrarAvanceProyecto(proyectoId, texto, req.user!); }
    catch (e) { if (e instanceof ErrorFichaViva) return reply.code(e.status).send({ error: e.message }); if (e instanceof z.ZodError) return reply.code(400).send({ error: 'Escribe un avance de 10 a 2000 caracteres' }); throw e; }
  });
}
