export type CreativeActionType='BRIEF'|'BRIEF_ADJUSTMENT'|'CONCEPTS'|'CONCEPT_ADJUSTMENT'|'RESOURCES'|'COVER_REVIEW';
export interface CreativeProject {id:string;code:string;title:string;authors:string;service:string;specialist:string|null;coverUrl:string|null}
export interface CreativeTask {
  id:string;workItemId:string;creativeProcessId:string;conceptId?:string;
  project:CreativeProject;type:CreativeActionType;label:string;cta:string;context:string;
  state:'Pendiente'|'En curso'|'Requiere ajustes';dueAt:string|null;overdue:boolean;dueToday:boolean;href:string;
}
export interface CreativeProcess {id:string;workItemId:string;project:CreativeProject;state:string;actionCount:number;href:string}
export interface CreativeRequest {id:string;workItemId:string;project:CreativeProject;label:string;requestedAt:string|null}
export interface CreativeDashboard {
  updatedAt:string;kpis:{briefs:number;concepts:number;covers:number;nextDueAt:string|null};
  attention:CreativeTask[];totalActions:number;tasks:CreativeTask[];deadlines:CreativeTask[];
  processes:CreativeProcess[];requests:CreativeRequest[];
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
