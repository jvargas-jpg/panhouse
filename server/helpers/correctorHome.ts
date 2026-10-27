import { pool } from '../db/client.js';
import { evaluarPlazoCorreccion } from './correccionSla.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { CorrectorDashboard, CorrectorHomeItem } from '../../shared/correctorHome.js';
const LABELS: Record<string, string> = { tripa_completa: 'Tripa completa', preliminares: 'Preliminares', cubierta_extendida: 'Cubierta extendida' };
type Row = { id:string; work_item_id:string; proyecto_id:string; codigo:string; title:string; authors:string; cover:string|null; alcance:string; estado:string; project_state:string; paused:boolean; blocker:string|null; due_at:Date|null; fecha_inicio:string|null; iniciado_en:Date|null; entregado_en:Date|null; fecha_entrega:string|null };
// One read query. Work-item assignment is authoritative; the legacy correction
// pointer is only used when that intervention has no assignment history at all.
export async function getCorrectorDashboard(correctorId:string, now=new Date()):Promise<CorrectorDashboard> {
  const { rows } = await pool.query<Row>(`SELECT c.id,c.work_item_id,c.proyecto_id,p.codigo,
    coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
    coalesce((SELECT string_agg(a.nombre,', ' ORDER BY a.nombre) FROM proyectos_autores x JOIN autores a ON a.id=x.autor_id WHERE x.proyecto_id=p.id),author.nombre) authors,
    CASE WHEN p.portada_decision_autor='aprobada' THEN p.propuesta_portada_url END cover,
    c.alcance,w.estado,p.estado project_state,w.gate_bloqueante blocker,c.due_at,c.fecha_inicio::text,c.iniciado_en,c.entregado_en,c.fecha_entrega::text,
    (p.estado IN ('pausado','stand_by') OR EXISTS(SELECT 1 FROM pausas ps WHERE ps.proyecto_id=p.id AND ps.fecha_inicio<=$2 AND (ps.fecha_fin IS NULL OR ps.fecha_fin>$2))) paused
    FROM correcciones c JOIN work_items w ON w.id=c.work_item_id AND w.proyecto_id=c.proyecto_id AND w.tipo='correccion'
    JOIN proyectos p ON p.id=c.proyecto_id JOIN autores author ON author.id=p.autor_id
    WHERE w.estado<>'cancelado' AND (CASE WHEN EXISTS(SELECT 1 FROM project_assignments a WHERE a.work_item_id=w.id AND a.proyecto_id=p.id AND a.tipo='corrector')
      THEN EXISTS(SELECT 1 FROM project_assignments a WHERE a.work_item_id=w.id AND a.proyecto_id=p.id AND a.tipo='corrector' AND a.finalizado_en IS NULL AND a.usuario_id=$1)
      ELSE c.corrector_id=$1 END OR (w.estado='completado' AND c.corrector_id=$1 AND EXISTS(
        SELECT 1 FROM project_assignments a WHERE a.work_item_id=w.id AND a.proyecto_id=p.id AND a.tipo='corrector' AND a.usuario_id=$1 AND a.finalizado_en IS NOT NULL AND
        ((c.entregado_en>=a.asignado_en AND c.entregado_en<=a.finalizado_en) OR (c.entregado_en IS NULL AND c.fecha_entrega>=(a.asignado_en AT TIME ZONE 'America/Caracas')::date AND c.fecha_entrega<=(a.finalizado_en AT TIME ZONE 'America/Caracas')::date)))))`,[correctorId,now]);
  const today=diaCaracas(now), monthStart=today.slice(0,7)+'-01';
  const items:CorrectorHomeItem[]=rows.filter(r=>r.estado==='completado'||!['culminado','retirado'].includes(r.project_state)).map(r=>{
    const completed=r.estado==='completado', blocked=r.estado==='bloqueado'||!!r.blocker;
    const state:CorrectorHomeItem['state']=completed?'completed':r.paused?'paused':blocked?'blocked':r.fecha_inicio||r.iniciado_en?'inProgress':'assigned';
    const actionable=!completed&&!r.paused&&!blocked;
    const stateLabel={completed:'Entregada',paused:'En pausa',blocked:'Bloqueada',inProgress:'En corrección',assigned:'Asignada'}[state];
    return {correctionId:r.id,workItemId:r.work_item_id,projectId:r.proyecto_id,code:r.codigo,title:r.title,authors:r.authors,coverUrl:r.cover,
      intervention:LABELS[r.alcance]??'Corrección editorial',state,stateLabel,deadline:r.due_at?.toISOString()??null,
      deadlineState:actionable?evaluarPlazoCorreccion(r.due_at,null,now):null,blocker:r.blocker,actionable,
      completedAt:r.entregado_en?.toISOString()??r.fecha_entrega,cta:completed?'Ver entrega':state==='blocked'?'Ver trabajo':state==='paused'?'Ver trabajo':state==='inProgress'?'Continuar':'Abrir trabajo'};
  });
  const active=items.filter(i=>i.state!=='completed');
  const rank=(i:CorrectorHomeItem)=>i.deadlineState==='vencido'?0:i.deadlineState==='proximo_a_vencer'?1:i.state==='blocked'?2:i.state==='inProgress'?3:i.state==='assigned'?4:5;
  active.sort((a,b)=>rank(a)-rank(b)||(a.deadline??'9999').localeCompare(b.deadline??'9999')||a.title.localeCompare(b.title,'es')||a.workItemId.localeCompare(b.workItemId));
  const recent=items.filter(i=>i.state==='completed'&&i.completedAt&&(i.completedAt.length===10?i.completedAt:diaCaracas(new Date(i.completedAt)))>=monthStart&&(i.completedAt.length===10?i.completedAt<=today:i.completedAt<=now.toISOString())).sort((a,b)=>b.completedAt!.localeCompare(a.completedAt!)||a.workItemId.localeCompare(b.workItemId));
  const next=active.filter(i=>i.actionable&&i.deadline&&i.deadline>=now.toISOString()).sort((a,b)=>a.deadline!.localeCompare(b.deadline!)||a.workItemId.localeCompare(b.workItemId))[0]??null;
  return {today,monthLabel:new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',month:'long',year:'numeric'}).format(now),
    summary:{active:active.length,dueSoon:active.filter(i=>i.deadlineState==='proximo_a_vencer').length,overdue:active.filter(i=>i.deadlineState==='vencido').length,completedThisMonth:recent.length},
    activeTotal:active.length,attentionItems:active.slice(0,8),nextDeadline:next,recentCompleted:recent.slice(0,3)};
}
