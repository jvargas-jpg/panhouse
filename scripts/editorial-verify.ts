/** Read-only verification of the disposable browser QA workflow. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const target=new URL(process.env.DATABASE_URL!);
if(!['localhost','127.0.0.1'].includes(target.hostname))throw Error('Local QA only');
target.pathname='/panhouse_edicion_preview';process.env.DATABASE_URL=target.toString();process.env.NODE_ENV='development';
const {pool}=await import('../server/db/client.js');
const {editorialDashboard,editorialInterventions}=await import('../server/helpers/editorialChief.js');
try{
 const dashboard=await editorialDashboard(),items=await editorialInterventions();
 const delivered=items.find(i=>i.code==='QA-ASIGNACIÓN'),waiting=items.find(i=>i.code==='QA-ESPERA');
 assert(delivered&&!delivered.actionable&&delivered.state==='Completadas');
 assert(waiting?.state==='Esperando autor'&&!waiting.overdue&&!waiting.atRisk);
 assert.equal(dashboard.summary.pendingRequests,0);assert.equal(dashboard.summary.unassigned,0);
 const history=await pool.query(`SELECT u.nombre editor,pa.finalizado_en IS NULL active,pa.motivo_fin reason FROM project_assignments pa JOIN usuarios u ON u.id=pa.usuario_id WHERE pa.proyecto_id=$1 AND pa.tipo='editor' ORDER BY pa.asignado_en,pa.id`,[waiting.projectId]);
 assert.equal(history.rows.filter(r=>r.active).length,1);assert(history.rows.length>=2);
 const events=await pool.query<{accion:string}>(`SELECT accion FROM audit_logs WHERE proyecto_id=$1 ORDER BY created_at,id`,[delivered.projectId]);
 for(const action of ['EDITOR_SOLICITADO','EDITOR_ASIGNADO','CAPITULO_EDITOR_ENTREGADO','CAPITULO_ENVIADO_AUTOR','CAPITULO_FEEDBACK_REGISTRADO','CAPITULO_FEEDBACK_APLICADO'])assert(events.rows.some(e=>e.accion===action),action);
 const result={verifiedAt:new Date().toISOString(),database:'panhouse_edicion_preview',browserWorkflow:'Solicitud → Asignación → Editor recibe trabajo → Entrega → Especialista envía al autor → Feedback → Editor aplica feedback',summary:dashboard.summary,delivery:{state:delivered.state,actionable:delivered.actionable,events:events.rows.map(e=>e.accion)},waiting:{state:waiting.state,overdue:waiting.overdue,atRisk:waiting.atRisk,editor:waiting.editor},assignmentHistory:history.rows,distribution:dashboard.interventionDistribution};
 await mkdir('docs/evidencias/jefe-edicion',{recursive:true});await writeFile('docs/evidencias/jefe-edicion/flujo-verificado.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({verified:true,events:events.rows.length,history:history.rows.length,waitingOverdue:waiting.overdue}));
}finally{await pool.end();}
