export type CreativeActionType='BRIEF'|'BRIEF_ADJUSTMENT'|'CONCEPTS'|'CONCEPT_ADJUSTMENT'|'RESOURCES'|'COVER_REVIEW';
export interface CreativeProject {id:string;code:string;title:string;authors:string;service:string;specialist:string|null;coverUrl:string|null}
export interface CreativeTask {
  id:string;workItemId:string;creativeProcessId:string;conceptId?:string;
  project:CreativeProject;type:CreativeActionType;label:string;cta:string;context:string;
  state:'Pendiente'|'En curso'|'Requiere ajustes';dueAt:string|null;overdue:boolean;dueToday:boolean;href:string;
}
export interface CreativeProcess {id:string;workItemId:string;project:CreativeProject;state:string;actionCount:number;href:string}
export interface CreativeRequest {id:string;workItemId:string|null;project:CreativeProject;label:string;requestedAt:string|null}
export interface CreativeDashboard {
  updatedAt:string;kpis:{briefs:number;concepts:number;covers:number;nextDueAt:string|null};
  attention:CreativeTask[];totalActions:number;tasks:CreativeTask[];deadlines:CreativeTask[];
  processes:CreativeProcess[];requests:CreativeRequest[];pendingRequests:number;
}
export interface CreativeActivity {id:string;at:string;label:string;actor:string;projectTitle:string;creativeProcessId:string;href:string}
export interface CreativeConcept {
  id:string;descripcion:string|null;enlace:string|null;estado:string|null;
  fechaAprobadaRrpp:string|null;fechaEnviadaAutor:string|null;fechaAprobadaAutor:string|null;
  feedbackRrpp:string|null;feedbackAutor:string|null;
}
export interface CreativeWorkDetail {
  id:string;workItemId:string;project:CreativeProject;state:string;actions:CreativeTask[];
  reunionRealizada:boolean;fechaReunion:string|null;enlaceGrabacion:string|null;
  briefEnlace:string|null;briefFeedback:string|null;fechaBriefEnviadoEspecialista:string|null;fechaBriefAprobadoAutor:string|null;
  recursoImagenUrl:string|null;recursoConceptoPdfUrl:string|null;concepts:CreativeConcept[];
  workspace:{rootUrl:string|null;designUrl:string|null};
  cover:{designId:string;versionId:string;number:number;url:string;briefUrl:string|null;imageUrl:string|null;conceptPdfUrl:string|null}|null;
}
export type CreativeWorkStatus = 'Pendiente'|'En curso'|'Requiere ajustes'|'Esperando RRPP'|'Esperando autor'|'Esperando Diseño'|'Esperando Especialista'|'Completada'|'Bloqueada';
export type CreativeWorkGroup = 'BRIEF'|'CONCEPT'|'RESOURCES'|'COVER_REVIEW';
export interface CreativeWorkItem extends Omit<CreativeTask,'state'|'href'> {
  feedbackSource?:'RRPP'|'AUTHOR'; feedback?:string; state:CreativeWorkStatus; group:CreativeWorkGroup; waitingOn:'RRPP'|'AUTHOR'|'DESIGN'|'SPECIALIST'|null;
  actionable:boolean; projectId:string; serviceId:string; createdAt:string; updatedAt:string;
}
export interface CreativeWorkFilters {
  tipo?:CreativeWorkGroup; estado?:CreativeWorkStatus; servicio?:string;
  fecha?:'hoy'|'semana'|'proximos'|'vencidos'|'sin-fecha'; search?:string;
  alcance?:'activas'|'todas'|'completadas'; orden?:'accion'|'fecha'; pagina?:number; pageSize?:number;
}
export interface CreativeWorkPage {
  items:CreativeWorkItem[]; total:number; page:number; pageSize:number; updatedAt:string;
  counts:{all:number; types:Record<CreativeWorkGroup,number>; states:Partial<Record<CreativeWorkStatus,number>>; services:{id:string;label:string;count:number}[]; overdue:number; actionable:number; requests:number};
}
