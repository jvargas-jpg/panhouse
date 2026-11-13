import { escalarColeccionInconsistente } from '../helpers/calidad.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import { ErrorDiseno } from '../helpers/diseno.js';
import { assignValidator, decideValidation, listValidations, readValidationFile, requestCoverValidator, requestValidator, startValidation, uploadValidation, validationCandidates, validationConfigurationWarnings, validationDetail, validationTimeline } from '../helpers/validaciones.js';
import { configureExternalDesign } from '../helpers/validationDrive.js';
import type { CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
const id = z.object({ id: z.string().uuid() });
export async function validacionesRoutes(app: FastifyInstance, options: { drive?: CorporateDriveOperation } = {}) {
 app.setErrorHandler((error, _req, reply) => { if (error instanceof ErrorDiseno) return reply.code(error.status).send({ error: error.message }); if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 413) return reply.code(413).send({ error: 'El archivo supera el tamaño permitido' }); app.log.error(error); return reply.code(500).send({ error: 'No se pudo completar la validación' }); });
 const validator = { preHandler: [requireAuth, requireRole('validador')] };
 const chief = { preHandler: [requireAuth, requireRole('jefe_area')] };
 const specialist = { preHandler: [requireAuth, requireRole('especialista')] };
 app.get('/', { preHandler: [requireAuth, requireRole('validador', 'especialista', 'jefe_area')] }, async (req, reply) => {
  const query = parseOrReply(z.object({ project: z.string().uuid().optional() }).strict(), req.query, reply); if (!query) return; return { items: await listValidations(req.user!, query.project), warnings: await validationConfigurationWarnings(req.user!) };
 });
 app.get('/candidatos', chief, async req => ({ items: await validationCandidates(req.user!) }));
 app.get('/timeline/:id', { preHandler: [requireAuth, requireRole('especialista', 'jefe_area', 'admin', 'rrpp')] }, async (req, reply) => { const p = parseOrReply(id, req.params, reply); if (!p) return; return { items: await validationTimeline(p.id, req.user!) }; });
 app.get('/:id', validator, async (req, reply) => { const p = parseOrReply(id, req.params, reply); if (!p) return; return validationDetail(p.id, req.user!); });
 app.get('/:id/archivo', validator, async (req, reply) => { const p = parseOrReply(id, req.params, reply); if (!p) return; const query = parseOrReply(z.object({ material: z.enum(['current','source','previous','previous_comments','legal']).default('current') }).strict(), req.query, reply); if (!query) return; const file = await readValidationFile(p.id, req.user!, query.material, options.drive); return reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff').type(file.mimeType).send(file.content); });
 app.post('/:id/solicitar', specialist, async (req, reply) => { const p = parseOrReply(id, req.params, reply); if (!p) return; return requestValidator(p.id, req.user!, options.drive); });
 app.post('/:id/asignar', chief, async (req, reply) => { const p = parseOrReply(id, req.params, reply); const b = parseOrReply(z.object({ validatorId: z.string().uuid(), dueAt: z.string().datetime({ offset: true }).optional() }).strict(), req.body, reply); if (!p || !b) return; return assignValidator(p.id, b.validatorId, b.dueAt, req.user!); });
 app.post('/:id/coleccion', validator, async (req, reply) => { const p = parseOrReply(id, req.params, reply); const b = parseOrReply(z.object({ motivo: z.string().trim().min(10).max(1000) }).strict(), req.body, reply); if (!p || !b) return; return escalarColeccionInconsistente(p.id, b.motivo, req.user!); });
 app.post('/:id/iniciar', validator, async (req, reply) => { const p = parseOrReply(id, req.params, reply); if (!p) return; return startValidation(p.id, req.user!); });
 app.post('/:id/archivo', { ...validator, bodyLimit: 28_100_000 }, async (req, reply) => { const p = parseOrReply(id, req.params, reply); const b = parseOrReply(z.object({ key: z.string().uuid(), name: z.string().min(1).max(250), contentBase64: z.string().max(28_000_000) }).strict(), req.body, reply); if (!p || !b) return; return uploadValidation(p.id, b, req.user!, options.drive); });
 app.post('/:id/decision', validator, async (req, reply) => { const p = parseOrReply(id, req.params, reply); const b = parseOrReply(z.object({ result: z.enum(['comentarios', 'todos_aplicados']), key: z.string().uuid(), assignmentId: z.string().uuid(), comments: z.number().int().positive().optional(), observations: z.string().max(10000).optional() }).strict(), req.body, reply); if (!p || !b) return; return decideValidation(p.id, b, req.user!); });
 app.post('/diseno/:id/solicitar-cubierta', specialist, async (req, reply) => { const p = parseOrReply(id, req.params, reply); if (!p) return; return requestCoverValidator(p.id, req.user!, options.drive); });
 app.post('/diseno/:id/proveedor', specialist, async (req, reply) => { const p = parseOrReply(id, req.params, reply); const b = parseOrReply(z.object({ name: z.string().trim().min(1).max(150), email: z.string().email().max(250) }).strict(), req.body, reply); if (!p || !b) return; return configureExternalDesign(p.id, b, req.user!); });
}
