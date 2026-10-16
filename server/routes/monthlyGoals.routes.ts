import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { cancelMonthlyGoal, createMonthlyGoal, currentGoalPeriod, GoalError, listMonthlyGoals, monthlyGoalCatalog, monthlyGoalDetail, summaryMonthlyGoals, teamMonthlyGoals, updateMonthlyGoal } from '../helpers/monthlyGoals.js';
import { GOAL_PROCESSES } from '../helpers/monthlyGoalEvaluation.js';

const period=z.string().regex(/^(20\d{2}|21\d{2}|2200)-(0[1-9]|1[0-2])$/);
const filters=z.object({period:period.default(currentGoalPeriod),specialistId:z.string().uuid().optional(),projectId:z.string().uuid().optional(),
  source:z.enum(['JEFATURA','ESPECIALISTA']).optional(),status:z.enum(['ACTIVO','EN_RIESGO','CUMPLIDO','NO_CUMPLIDO','CANCELADO']).optional(),
  page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(50).default(20)}).strict();
const goalFields={periodYear:z.number().int().min(2000).max(2200),periodMonth:z.number().int().min(1).max(12),projectId:z.string().uuid().nullable(),
  title:z.string().trim().min(5).max(250),description:z.string().trim().max(2000).nullable(),goalType:z.enum(['GENERAL','CIERRE_PROYECTO','ALCANZAR_PROCESO','ALCANZAR_HITO']),
  targetProcess:z.string().refine(s=>Object.hasOwn(GOAL_PROCESSES,s)).nullable(),targetWorkItemId:z.string().uuid().nullable(),targetDate:z.string().date()};
function validateGoal(g:z.infer<ReturnType<typeof z.object<typeof goalFields>>>,ctx:z.RefinementCtx) {
  if(g.goalType!=='GENERAL'&&!g.projectId)ctx.addIssue({code:'custom',path:['projectId'],message:'Este resultado requiere un proyecto'});
  if((g.goalType==='ALCANZAR_PROCESO')!==!!g.targetProcess)ctx.addIssue({code:'custom',path:['targetProcess'],message:'Selecciona el proceso del objetivo'});
  if((g.goalType==='ALCANZAR_HITO')!==!!g.targetWorkItemId)ctx.addIssue({code:'custom',path:['targetWorkItemId'],message:'Selecciona el hito del objetivo'});
  // Permitir ajustar fecha más allá del mes conserva el periodo original.
  if(g.targetDate<`${g.periodYear}-${String(g.periodMonth).padStart(2,'0')}-01`)ctx.addIssue({code:'custom',path:['targetDate'],message:'La fecha no puede preceder al periodo'});
}
const create=z.object({...goalFields,specialistId:z.string().uuid().optional(),idempotencyKey:z.string().uuid()}).strict().superRefine(validateGoal);
const edit=z.object({...goalFields,updatedAt:z.string().datetime(),changeReason:z.string().trim().min(5).max(1000)}).strict().superRefine(validateGoal);
const cancel=z.object({reason:z.string().trim().min(5).max(1000),updatedAt:z.string().datetime()}).strict();
const id=z.object({id:z.string().uuid()});
export async function monthlyGoalsRoutes(app: FastifyInstance) {
  app.setErrorHandler((e,_req,reply)=>{
    if(e instanceof GoalError)return reply.code(e.status).send({error:e.message});
    if(e instanceof z.ZodError)return reply.code(400).send({error:e.issues[0]?.message ?? 'Datos de objetivo inválidos',detalles:e.flatten()});
    throw e;
  });
  const preHandler=[requireAuth,requireRole('especialista','jefe_area')];
  app.get('/',{preHandler},req=>listMonthlyGoals(req.user!,filters.parse(req.query)));
  app.get('/summary',{preHandler},req=>{const q=filters.parse(req.query);return summaryMonthlyGoals(req.user!,q.period,q.specialistId);});
  app.get('/team',{preHandler:[requireAuth,requireRole('jefe_area')]},req=>teamMonthlyGoals(req.user!,z.object({period:period.default(currentGoalPeriod)}).strict().parse(req.query).period));
  app.get('/catalog',{preHandler},req=>monthlyGoalCatalog(req.user!,z.object({specialistId:z.string().uuid().optional()}).strict().parse(req.query).specialistId));
  app.get('/:id',{preHandler},req=>monthlyGoalDetail(req.user!,id.parse(req.params).id));
  app.post('/',{preHandler},async(req,reply)=>{const result=await createMonthlyGoal(req.user!,create.parse(req.body));return reply.code(result.alreadyExisted?200:201).send(result);});
  app.patch('/:id',{preHandler},req=>updateMonthlyGoal(req.user!,id.parse(req.params).id,edit.parse(req.body)));
  app.post('/:id/cancel',{preHandler},req=>{const b=cancel.parse(req.body);return cancelMonthlyGoal(req.user!,id.parse(req.params).id,b.reason,b.updatedAt);});
}
