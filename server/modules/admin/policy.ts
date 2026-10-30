import type {FastifyRequest,FastifyReply} from 'fastify';
import {hasAdminPermission,type AdminPermission} from '../../../shared/admin.js';
export function adminAssert(value:unknown,message:string,statusCode=409):asserts value{if(!value)throw Object.assign(new Error(message),{statusCode});}
export function requireAdmin(permission:AdminPermission){return async(req:FastifyRequest,reply:FastifyReply)=>{if(!hasAdminPermission(req.user?.rol,permission)||req.realAdmin)await reply.code(403).send({error:'Se requiere un permiso administrativo'});};}
// Audit metadata is recursively reduced before it crosses the administrative API.
// Free text is not interpreted as safe JSON and URLs cannot carry credentials.
const protectedKey=/(password|passwd|hash|token|secret|cookie|credential|credencial|authorization|amazon.*cuenta|cuenta.*amazon|recovery.?code|code.?verifier|encryption.?key)/i;
export function safeAdminData(value:unknown,depth=0):unknown{
 if(depth>10)return '[Límite de profundidad]';
 if(value instanceof Date)return value.toISOString();
 if(Array.isArray(value))return value.slice(0,200).map(v=>safeAdminData(v,depth+1));
 if(value&&typeof value==='object'){
  const record=value as Record<string,unknown>;
  if(typeof record.key==='string'&&protectedKey.test(record.key)||typeof record.campo==='string'&&protectedKey.test(record.campo))return {field:'[campo protegido]',value:'[omitido]'};
  return Object.fromEntries(Object.entries(value).filter(([k])=>!protectedKey.test(k)).map(([k,v])=>[k,safeAdminData(v,depth+1)]));
 }
 if(typeof value==='string')return value.slice(0,8000).replace(/https?:\/\/[^\s"<>]+/g,url=>{try{const u=new URL(url);if(u.username||u.password||[...u.searchParams.keys()].some(k=>protectedKey.test(k)))return '[enlace con credenciales omitido]';return url;}catch{return '[enlace omitido]';}}).replace(/Bearer\s+\S+/gi,'[credencial omitida]').replace(/\b(access_token|refresh_token|password|secret|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi,'[credencial omitida]');
 return value;
}
