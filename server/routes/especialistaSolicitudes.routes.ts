import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { ErrorFichaViva } from '../helpers/fichaViva.js';
import { listarSolicitudes, detalleSolicitud } from '../helpers/especialistaSolicitudes.js';
import { gestionarContrato, solicitarContrato } from '../helpers/contratosCorreccion.js';
const query=z.object({tab:z.enum(['abiertas','informacion','resueltas','todas']).default('abiertas'),tipo:z.enum(['editor','creativa','contrato','calidad','digital','lanzamiento','impresion']).optional(),destino:z.enum(['jefe_edicion','lider_creativo','talento_humano','soporte_editorial','soporte_digital','rrpp']).optional(),estado:z.enum(['pendiente','en_revision','requiere_informacion','resuelta','rechazada','cancelada']).optional(),proyecto:z.string().uuid().optional(),desde:z.string().date().optional(),hasta:z.string().date().optional(),search:z.string().trim().max(200).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().refine(n=>[10,20,50].includes(n)).default(20)}).refine(f=>!f.desde||!f.hasta||f.desde<=f.hasta);
const id=z.object({id:z.string().uuid()});
const command=z.discriminatedUnion('accion',[
  z.object({accion:z.literal('revisar')}).strict(),
  z.object({accion:z.literal('informacion'),texto:z.string().trim().min(10).max(2000)}).strict(),
  z.object({accion:z.literal('responder'),texto:z.string().trim().min(10).max(2000),preguntaId:z.string().uuid()}).strict(),
  z.object({accion:z.literal('confirmar')}).strict(),
  z.object({accion:z.literal('rechazar'),texto:z.string().trim().min(10).max(2000)}).strict(),
]);
export async function especialistaSolicitudesRoutes(app: FastifyInstance) {
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof ErrorFichaViva)return reply.code(error.status).send({error:error.message});
    if(error instanceof z.ZodError)return reply.code(400).send({error:'Datos de solicitud inválidos'});
    throw error;
  });
  const preHandler=[requireAuth,requireRole('especialista','talento_humano','rrpp')];
  app.get('/solicitudes',{preHandler},req=>listarSolicitudes(req.user!,query.parse(req.query)));
  app.get('/solicitudes/:id',{preHandler},req=>detalleSolicitud(id.parse(req.params).id,req.user!));
  app.post('/solicitudes/:id/contrato',{preHandler},req=>gestionarContrato(id.parse(req.params).id,command.parse(req.body),req.user!));
  app.post('/correcciones/:id/solicitar-contrato',{preHandler:[requireAuth,requireRole('especialista')]},req=>{
    const body=z.object({correctorNombre:z.string().trim().min(3).max(200),disponibilidadConfirmada:z.literal(true)}).strict().parse(req.body);
    return solicitarContrato(id.parse(req.params).id,body.correctorNombre,req.user!);
  });
}
