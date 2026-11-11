import { apiFetch } from '../lib/api';
export interface AuthorProject {id:string;title:string|null;service:string;serviceCode:string;startDate:string|null;plannedStart:string;estimatedDate:string|null;specialist:string|null;stage:number;stageLabel:string;status:string;nextMilestone:string}
export interface AuthorDocument {id:string;projectId?:string;title:string;version:string;category?:string;sharedAt?:string;available?:boolean;approved?:boolean}
export interface Approval {id:string;projectId:string;projectTitle:string|null;type:string;title:string;instructions:string;requestedAt:string;dueAt:string|null;status:'pending'|'approved'|'changes_requested'|'cancelled';feedback:string|null;decidedAt:string|null;previousId:string|null;sentBy:string;external:boolean;overdueDays:number;documents:AuthorDocument[]}
export interface AuthorRequest {id:string;projectId:string;reason:string;comment:string|null;status:string;requestedAt:string;start:string;returnDate:string|null;response:string|null;resolvedAt:string|null;pausedAt:string|null;resumedAt:string|null}
export interface AuthorNotification {id:string;message:string;path:string|null;read:boolean;createdAt:string}
export const authorGet=<T,>(path:string)=>apiFetch<T>('/autor'+path);
export const authorPost=<T=unknown,>(path:string,body:unknown={})=>apiFetch<T>('/autor'+path,{method:'POST',body:JSON.stringify(body)});
export const dateLabel=(date:string|null|undefined)=>date?new Date(date.length===10?date+'T12:00:00-04:00':date).toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Caracas'}):'Por confirmar';
export function deadlineLabel(a:Approval){return a.overdueDays>0?`Vencida hace ${a.overdueDays} ${a.overdueDays===1?'día':'días'}`:a.dueAt?`Responder antes del ${dateLabel(a.dueAt)}`:'Sin fecha límite';}
export const decisionLabel=(status:string)=>({pending:'◷ Pendiente',approved:'✓ Aprobado',changes_requested:'↩ Cambios solicitados',cancelled:'— Solicitud retirada'}[status]??status);
