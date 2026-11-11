import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { z } from 'zod';
import { direccionesCreativas, disenos, fichaCalidadFases, fichaDisenoPropuestas, fichasTrazabilidad, proyectos, users } from '../db/schema/index.js';
// The controlled external-decision command is the only manual path for an
// enrolled Author. Legacy projects without an account remain compatible.
export async function guardLegacyAuthorDecision(req:FastifyRequest,reply:FastifyReply){
 if(!req.user||!['PATCH','POST','PUT'].includes(req.method)||req.url.startsWith('/api/autor/'))return;
 const path=req.url.split('?')[0]!,params=req.params as Record<string,string>,body=req.body as Record<string,unknown>|undefined;
 if([params.id,params.proyectoId,params.propuestaId].filter(Boolean).some(v=>!z.string().uuid().safeParse(v).success))return;
 let projectId:string|undefined;
 if(/\/api\/direccion-creativa\/[^/]+\/brief-autor$/.test(path))projectId=(await db.select({id:direccionesCreativas.proyectoId}).from(direccionesCreativas).where(eq(direccionesCreativas.id,params.id!)))[0]?.id;
 else if(/\/api\/direccion-creativa\/propuestas\/[^/]+\/autor$/.test(path))projectId=(await db.select({id:fichasTrazabilidad.proyectoId}).from(fichaDisenoPropuestas).innerJoin(fichasTrazabilidad,eq(fichasTrazabilidad.id,fichaDisenoPropuestas.fichaId)).where(eq(fichaDisenoPropuestas.id,params.propuestaId!)))[0]?.id;
 else if(/\/api\/diseno\/[^/]+\/versiones\/[^/]+$/.test(path)&&['enviar_autor','aprobar_autor','feedback'].includes(String(body?.accion)))projectId=(await db.select({id:disenos.proyectoId}).from(disenos).where(eq(disenos.id,params.id!)))[0]?.id;
 else if(/\/api\/calidad\/[^/]+\/coordinacion$/.test(path)&&['enviar_autor','aprobar_autor','feedback_autor'].includes(String(body?.accion)))projectId=(await db.select({id:fichasTrazabilidad.proyectoId}).from(fichaCalidadFases).innerJoin(fichasTrazabilidad,eq(fichasTrazabilidad.id,fichaCalidadFases.fichaId)).where(eq(fichaCalidadFases.id,params.id!)))[0]?.id;
 else if(/\/api\/capitulos\/[^/]+\/\d+\/autor$/.test(path))projectId=params.proyectoId;
 else if(/\/api\/proyectos\/[^/]+\/(feedback-tripa|aprobacion-final|decision-portada)$/.test(path))projectId=params.id;
 else if(path.startsWith('/api/fichas-trazabilidad/')&&params.proyectoId&&body&&Object.keys(body).some(k=>/fecha.*aproba.*autor|fecha.*respuesta.*real|fecha.*envi.*autor|portadaDecisionAutor/i.test(k)))projectId=params.proyectoId;
 if(!projectId)return;
 const [enabled]=await db.select({id:proyectos.id}).from(proyectos).where(and(eq(proyectos.id,projectId),sql`EXISTS (SELECT 1 FROM usuarios u WHERE u.rol='autor' AND (u.autor_id=${proyectos.autorId} OR EXISTS (SELECT 1 FROM proyectos_autores pa WHERE pa.proyecto_id=${proyectos.id} AND pa.autor_id=u.autor_id)))`));
 if(enabled)return reply.code(409).send({error:'Este Autor utiliza el portal. Solicita la aprobación o registra una decisión externa con evidencia desde Participación del Autor.'});
}
