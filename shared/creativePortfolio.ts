import type {CreativeActionType,CreativeConcept,CreativeProject,CreativeWorkItem} from './creativeLeader.js';
export type CreativeProjectStage='MEETING'|'BRIEF'|'CONCEPTS'|'RESOURCES'|'COVER'|'COMPLETED'|'BLOCKED';
export interface CreativePortfolioFilters {search?:string;service?:string;creativeState?:CreativeProjectStage;specialist?:string;scope?:'active'|'all'|'completed';page?:number;pageSize?:number;sort?:'attention'|'activity'|'title'}
export interface CreativeProjectActivity {id:string;at:string;label:string;actor:string}
export interface CreativeProjectSummary {
 projectId:string;creativeProcessId:string;rootProcessId:string;project:CreativeProject;
 service:{id:string;code:string;name:string};specialist:{id:string;name:string}|null;
 creativeState:CreativeProjectStage;stateLabel:string;stateDetail:string;waitingOn:CreativeWorkItem['waitingOn']|'CREATIVE'|null;
 nextStep:string;currentDeadline:string|null;lastActivity:CreativeProjectActivity|null;
 currentWorkItem:{workItemId:string;creativeProcessId:string;type:CreativeActionType;conceptId?:string;cta:string}|null;
 conceptSummary:{total:number;approved:number};resourceSummary:{image:boolean;pdf:boolean};coverStatus:string|null;
}
export interface CreativePortfolioPage {
 items:CreativeProjectSummary[];total:number;page:number;pageSize:number;updatedAt:string;
 counts:{all:number;stages:Partial<Record<CreativeProjectStage,number>>;services:{id:string;label:string;count:number}[];specialists:{id:string;label:string;count:number}[];actionable:number;requests:number};
}
export interface CreativePortfolioConcept extends CreativeConcept {thumbnailUrl:string|null;statusLabel:string;approved:boolean}
export interface CreativeProjectDetail {
 summary:CreativeProjectSummary;concepts:CreativePortfolioConcept[];
 resources:{type:'CONCEPT_IMAGE'|'CONCEPT_PDF';label:string;url:string;conceptId:string;submittedAt:string|null}[];
 activity:CreativeProjectActivity[];workspace:{rootUrl:string|null;designUrl:string|null};
 brief:{url:string|null;approvedAt:string|null};cover:{version:number;url:string;reviewResult:string|null}|null;
}
