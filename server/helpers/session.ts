import { createHash,randomBytes } from 'node:crypto';
import {eq,isNull,and,sql} from 'drizzle-orm';
import {db,pool} from '../db/client.js';
import {sessions,securityEvents,type Rol} from '../db/schema/index.js';
import {env} from '../config/env.js';
export interface AuthenticatedUser{id:string;email:string;nombre:string;rol:Rol;autorId:string|null;adminView?:{active:true;adminName:string}}
export interface SessionMetadata{ip?:string;userAgent?:string}
export const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function createSession(userId:string,metadata:SessionMetadata={}):Promise<string>{
 const token=randomBytes(32).toString('hex');
 await db.transaction(async tx=>{
  // Creation and validation use the same clock, including when application
  // clocks drift or a business-date test overrides Date in the Node process.
  const [created]=await tx.insert(sessions).values({id:hashToken(token),userId,expiresAt:sql`now()+make_interval(hours => ${env.SESSION_TTL_HOURS}::int)`,lastActivityAt:sql`now()`,ip:metadata.ip?.slice(0,64),userAgent:metadata.userAgent?.slice(0,400)}).returning({publicId:sessions.publicId});
  await tx.insert(securityEvents).values({action:'LOGIN_SUCCESS',actorId:userId,targetUserId:userId,sessionPublicId:created!.publicId,ip:metadata.ip?.slice(0,64),userAgent:metadata.userAgent?.slice(0,400)});
 });return token;
}
export async function sessionContext(token:string):Promise<{user:AuthenticatedUser;realAdmin?:AuthenticatedUser;publicId:string}|null>{
 const {rows:[r]}=await pool.query<{
 id:string;email:string;nombre:string;rol:Rol;autor_id:string|null;public_id:string;
 view_id:string|null;view_email:string|null;view_name:string|null;view_role:Rol|null;view_author:string|null;view_active:boolean|null;
 }>(`WITH valid AS(SELECT s.id session_hash,s.public_id,s.last_activity_at,u.id,u.email,u.nombre,u.rol,u.autor_id,
 v.id view_id,v.email view_email,v.nombre view_name,v.rol view_role,v.autor_id view_author,v.activo view_active
 FROM sesiones s JOIN usuarios u ON u.id=s.user_id LEFT JOIN usuarios v ON v.id=s.view_as_user_id
 WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.activo),
 touched AS(UPDATE sesiones SET last_activity_at=now() WHERE id=(SELECT session_hash FROM valid) AND (last_activity_at IS NULL OR last_activity_at<now()-interval '1 minute') RETURNING public_id)
 SELECT id,email,nombre,rol,autor_id,public_id,view_id,view_email,view_name,view_role,view_author,view_active FROM valid`,[hashToken(token)]);
 if(!r)return null;
 const real:AuthenticatedUser={id:r.id,email:r.email,nombre:r.nombre,rol:r.rol,autorId:r.autor_id};
 if(r.view_id&&r.rol==='admin'){
  if(!r.view_active||!r.view_role||r.view_role==='admin')await db.update(sessions).set({viewAsUserId:null}).where(eq(sessions.publicId,r.public_id));
  else return {publicId:r.public_id,realAdmin:real,user:{id:r.view_id,email:r.view_email!,nombre:r.view_name!,rol:r.view_role,autorId:r.view_author,adminView:{active:true,adminName:r.nombre}}};
 }
 return {user:real,publicId:r.public_id};
}
export async function validateSession(token:string):Promise<AuthenticatedUser|null>{return (await sessionContext(token))?.user??null;}
export async function destroySession(token:string):Promise<void>{
 await db.transaction(async tx=>{
  const [s]=await tx.update(sessions).set({revokedAt:new Date(),revokeReason:'Cierre de sesión',viewAsUserId:null}).where(and(eq(sessions.id,hashToken(token)),isNull(sessions.revokedAt))).returning({userId:sessions.userId,publicId:sessions.publicId});
  if(s)await tx.insert(securityEvents).values({action:'LOGOUT',actorId:s.userId,targetUserId:s.userId,sessionPublicId:s.publicId});
 });
}
