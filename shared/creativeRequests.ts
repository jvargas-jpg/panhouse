import type {CreativeProject} from './creativeLeader.js';
export type CreativeRequestStatus='PENDING'|'ACCEPTED'|'REJECTED'|'CANCELLED';
export interface CreativeRequestFilters {status?:CreativeRequestStatus|'ALL';service?:string;specialist?:string;search?:string;date?:'today'|'week'|'range';from?:string;to?:string;page?:number;pageSize?:number}
export interface CreativeRequestSummary {
 id:string;type:'CREATIVE_MEETING_REQUEST';typeLabel:string;summary:string;project:CreativeProject;
 service:{id:string;code:string;name:string};specialist:{id:string;name:string}|null;
 requestedBy:{id:string;name:string}|null;status:CreativeRequestStatus;requestedAt:string;
 resolvedAt:string|null;resolvedBy:{id:string;name:string}|null;reason:string|null;
 generatedWorkItemId:string|null;creativeProcessId:string|null;canOpenWork:boolean;
}
export interface CreativeRequestPage {items:CreativeRequestSummary[];total:number;page:number;pageSize:number;counts:{all:number;statuses:Partial<Record<CreativeRequestStatus,number>>;pending:number;actionableWork:number;services:{id:string;label:string;count:number}[];specialists:{id:string;label:string;count:number}[]}}
export interface CreativeRequestDetail {
 summary:CreativeRequestSummary;description:string;descriptionSource:'SPECIALIST'|'WORKFLOW';
 gates:{key:string;label:string;met:boolean;required:boolean;detail:string}[];
 canAccept:boolean;canReject:boolean;blockedReason:string|null;conversionLabel:string;
 materials:{key:string;name:string;kind:string;url:string;sizeBytes:number|null}[];
 activity:{id:string;label:string;actor:string;at:string}[];
 workspace:{rootUrl:string|null;designUrl:string|null};
}
