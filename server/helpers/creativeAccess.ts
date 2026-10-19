import {and,eq,isNull} from 'drizzle-orm';
import {db} from '../db/client.js';
import {direccionesCreativas,projectAssignments} from '../db/schema/index.js';
import type {Tx} from './tx.js';
export async function hasCreativeProjectAccess(projectId:string,userId:string,client:typeof db|Tx=db){
  const [a]=await client.select({id:projectAssignments.id}).from(projectAssignments)
    .innerJoin(direccionesCreativas,eq(direccionesCreativas.workItemId,projectAssignments.workItemId))
    .where(and(eq(direccionesCreativas.proyectoId,projectId),eq(projectAssignments.usuarioId,userId),eq(projectAssignments.tipo,'lider_creativo'),isNull(projectAssignments.finalizadoEn))).limit(1);
  return !!a;
}
