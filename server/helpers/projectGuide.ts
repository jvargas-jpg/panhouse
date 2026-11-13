import { db } from '../db/client.js';
import type { ProjectCommandCenter, ProcesoProyecto } from '../../shared/projectCommandCenter.js';
import { PROCESOS_OPERATIVOS, type ContextoActivacion } from '../../shared/operacionEspecialista.js';
import { coverRound } from './coverValidation.js';
import type { GuidePath, GuideRequirement, GuideStep, ProjectGuide } from '../../shared/projectGuide.js';
import type { Rol } from '../db/schema/index.js';
import { creativeReady, currentDesignVersion, finalPackageGate, projectWorkflowFacts, requirement as req, type WorkflowFacts } from './finalPackage.js';
import type { getProjectFinancialStatus } from './estadoFinanciero.js';
import { editorialInterventions, EDITORIAL_RESPONSIBLE } from './editorialChief.js';
import { evaluarGateMomentoReunionCreativa } from './gates.js';

// Escritura Fantasma (EF): reuniones de extracción, sub-paso de Preparación
// Inicial antes de poder solicitar Editor. Otros servicios (EEC, etc.) no
// lo requieren hasta confirmar su propio set de documentos — no se inventa
// un requisito para ellos.
const SERVICIOS_CON_EXTRACCION = ['EF'];

type Context = Pick<ProjectCommandCenter, 'preparacion' | 'procesos'>;
/** One read projection for both project detail and portfolio; no persisted guide state. */
export function guideProcesses(f: WorkflowFacts, activations: ContextoActivacion[]): ProcesoProyecto[] {
 const alias=(code:string)=>code==='digital'?'soporte_digital':code;
 const ignored=new Set(['proyecto','ingreso','intake_rrpp','asignacion_especialista']);
 const configured=f.configuration.filter(c=>!ignored.has(c.code));
 const types=new Set(configured.length ? configured.map(c=>alias(c.code)) : Object.keys(PROCESOS_OPERATIVOS).filter(t=>!['revision_interna_cubierta','validacion_cubierta'].includes(t)));
 for(const w of f.works)if(!ignored.has(w.tipo))types.add(w.tipo);
 const hasSpecialist=f.assignments.some(a=>a.tipo==='especialista'&&!a.workItemId) ? f.assignments.some(a=>a.tipo==='especialista'&&!a.workItemId&&!a.finalizadoEn) : !!f.p.especialistaId;
 if(hasSpecialist)types.add('preparacion_inicial'); else types.delete('preparacion_inicial');
 if(f.serviceCode==='SE'&&!f.works.some(w=>w.tipo==='edicion'))types.delete('edicion');
 return [...types].map(tipo=>{
  const owner=PROCESOS_OPERATIVOS[tipo];
  const works=f.works.filter(w=>w.tipo===tipo);
  const active=works.filter(w=>!['completado','cancelado'].includes(w.estado));
  const activation=activations.find(a=>a.tipo===tipo);
  return {tipo,nombre:owner?.nombre??f.configuration.find(c=>alias(c.code)===tipo)?.name??tipo,
   estado:active.some(w=>w.estado==='bloqueado')?'Bloqueado':active.length?'En curso':works.some(w=>w.estado==='completado')?'Completo':'No iniciado',
   detalle:owner ? 'Continúa desde los requisitos y operaciones de este proceso.' : 'Proceso definido por la configuración editorial del servicio.',
   trabajos:works.map(w=>({id:w.id,tipo:w.tipo,nombre:owner?.nombre??tipo,estado:w.estado,instancia:w.businessKey,responsable:null,vence:w.fechaFinPautada,vencido:false,gate:w.gateBloqueante,decisionId:null,inicio:w.fechaInicioReal,cierre:w.fechaFinReal})),
   ownerRole:owner?.ownerRole,ownerLabel:owner?.ownerLabel,coordinacion:owner?.coordinacion,activacion:activation,
   action:owner?{kind:'abrir',label:'Completar este paso'}:null};
 });
}
export async function projectGuide(id: string, data: Context, actor: { id: string; rol: Rol }, known: { facts?: WorkflowFacts; editorial?: Awaited<ReturnType<typeof editorialInterventions>>; financial?: Awaited<ReturnType<typeof getProjectFinancialStatus>> } = {}): Promise<ProjectGuide> {
 const facts = known.facts ?? await projectWorkflowFacts(id);
 const [editorial, finalPackage] = await Promise.all([known.editorial ?? editorialInterventions(undefined, id), finalPackageGate(id, db, facts, known.financial)]);
 const requests=facts.requests, contracts=facts.contracts;
 const assignments=facts.assignments.filter(a=>!a.finalizadoEn).map(a=>({a,name:facts.participants.find(p=>p.id===a.usuarioId)?.nombre??'Responsable registrado'}));
 const specialist=facts.assignments.some(a=>a.tipo==='especialista'&&!a.workItemId)?assignments.find(a=>a.a.tipo==='especialista'&&!a.a.workItemId)?.a.usuarioId:facts.p.especialistaId;
 const editable = actor.rol === 'especialista' && ['en_proceso','retrasado'].includes(facts.p.estado);
 const p = data.preparacion;
 const step = (id: string, label: string, requirements: GuideRequirement[]): GuideStep => ({ id, label, requirements, completed: requirements.every(r => r.satisfied) });
 const extraccion = facts.extraction;
 const downstream = facts.works.some(w=>!['intake_rrpp','asignacion_especialista','preparacion_inicial'].includes(w.tipo));
 // No retroactivo: un proyecto que ya tiene trabajo posterior (Corrección,
 // Edición, etc.) ya pasó Preparación bajo las reglas vigentes entonces.
 // Exigir estos pasos nuevos ahí reabriría preparaciones ya cerradas y las
 // marcaría como inconsistencia histórica de solo lectura — solo aplica a
 // proyectos que todavía no avanzaron más allá de Preparación Inicial.
 const requiereExtraccion = SERVICIOS_CON_EXTRACCION.includes(facts.serviceCode ?? '') && !downstream;
 const preparation = [
  step('recepcion', 'Recibir y revisar expediente', [req('received','Proyecto recibido',p.recibidoEn,'preparaciones_proyecto'),req('reviewed','Expediente revisado',p.expedienteRevisadoEn,'preparaciones_proyecto')]),
  step('contacto', 'Primer contacto', [req('contact','Primer contacto realizado',p.primerContactoEn,'preparaciones_proyecto')]),
  step('reunion', 'Reunión operativa', [req('meeting','Reunión realizada',p.reunionOperativaRealizada,'preparaciones_proyecto')]),
  step('documentos', 'Organizar documentos', [req('drive','Drive del proyecto disponible',p.driveEstado === 'configurado','project_drive_workspaces'),...(['minutaUrl','cronogramaUrl','grabacionUrl','transcripcionUrl'] as const).map((key,i)=>req(key,['Minuta','Cronograma','Grabación','Transcripción'][i]!,p[key],'preparaciones_proyecto')),
   ...(requiereExtraccion ? [req('estructuraPreliminaresUrl','Estructura de preliminares',p.estructuraPreliminaresUrl,'preparaciones_proyecto'),req('solicitudInformacionAutorUrl','Solicitud de información para "Sobre el autor"',p.solicitudInformacionAutorUrl,'preparaciones_proyecto')] : [])]),
  ...(requiereExtraccion ? [
   step('reuniones_extraccion', 'Registrar reuniones de extracción', [req('extraction-meetings','Al menos una reunión de extracción registrada',extraccion.some(r=>r.realizada),'reuniones_extraccion')]),
   step('archivos_extraccion', 'Subir archivos de la extracción', [req('extraction-files','Archivos de la extracción recibidos',!!p.extraccionEnlaces?.length,'preparaciones_proyecto')]),
  ] : []),
 ];
 const completedPreparation = preparation.every(s => s.completed);
 const paths: GuidePath[] = [];
 // Viewer-specific attention ordering must not change the project's position.
 const order = ['preparacion_inicial','edicion','correccion','direccion_creativa','diseno','calidad','validacion_cubierta','soporte_digital','lanzamiento','impresion','distribucion'];
 const ordered = guideProcesses(facts, data.procesos.flatMap(p=>p.activacion?[p.activacion]:[])).sort((a,b)=>(order.indexOf(a.tipo)<0?99:order.indexOf(a.tipo))-(order.indexOf(b.tipo)<0?99:order.indexOf(b.tipo)) || a.tipo.localeCompare(b.tipo));
 for (const process of ordered) {
  let requirements: GuideRequirement[] = [], steps: GuideStep[] = [], waiting: string | null = null;
  let instruction = process.detalle, currentStep = process.nombre;
  let complete = process.estado === 'Completo', canAct = false;
  const iso = (value: Date | string | null | undefined) => value instanceof Date ? value.toISOString() : value ?? null;
  let requestedAt: string | null=null, assignedAt: string | null=null, assignee: string | null=null;
  let waitingSince: string | null=null, dueAt: string | null=null, delivery: GuidePath['delivery']=null;
  let action: GuidePath['action'] = { kind: 'native', label: 'Completar este paso' };
  const person = assignments.find(x => x.a.tipo === process.ownerRole && (!x.a.workItemId || process.trabajos.some(w=>w.id===x.a.workItemId)))?.name ?? process.assignee ?? process.ownerLabel ?? 'Especialista';
  if (process.tipo === 'preparacion_inicial') {
   steps = preparation; const current = preparation.find(s => !s.completed) ?? preparation.at(-1)!;
   requirements = current.requirements; currentStep = current.label; complete = completedPreparation;
   instruction = complete ? 'Preparación completada. Elige un proceso disponible.' : 'Completa los requisitos de este paso. Los datos se guardan también en el expediente.';
   canAct = !complete;
   dueAt = current.id==='contacto' ? p.primerContactoDueAt : null;
  } else if (process.tipo === 'edicion') {
   const editor = assignments.find(a => a.a.tipo === 'editor' && !a.a.workItemId);
   const assigned = !!editor || !!facts.editorId;
   const requested = requests.find(r => r.tipo === 'editor' && ['pendiente','en_revision','requiere_informacion'].includes(r.estado));
   requestedAt=iso(requested?.requestedAt); assignedAt=iso(editor?.a.asignadoEn); assignee=editor?.name??null;
   requirements = [req('editor','Editor asignado por Jefatura de Edición',assigned,'project_assignments'),req('manuscript','Material editorial disponible',facts.p.manuscritoUrl || facts.chapters.length,'proyectos / capitulos')];
   if (!assigned) {
    const needsResponse = requested?.estado === 'requiere_informacion';
    waiting = requested && !needsResponse ? 'Jefatura de Edición' : null; canAct = !requested || needsResponse;
    currentStep = needsResponse ? 'Completar y reenviar solicitud de Editor' : requested ? 'Esperando asignación de Jefatura de Edición' : 'Solicitar Editor';
    instruction = requested ? `Solicitud enviada el ${requested.requestedAt.toISOString().slice(0,10)}. No necesitas hacer nada aquí por ahora.` : 'Solicita Editor dentro de este proyecto. Jefatura de Edición asigna según carga.';
    if(needsResponse) instruction = requested.motivo ?? 'Jefatura de Edición necesita información adicional. Revisa la solicitud y reenvíala desde este paso.';
    action = { kind: 'request_editor', label: needsResponse ? 'Reenviar solicitud de Editor' : 'Solicitar Editor' };
    waitingSince=requestedAt;
   } else {
    const current = editorial.find(i => i.state === 'Esperando Especialista') ?? editorial.find(i => i.state !== 'Completadas');
    const chapter = facts.chapters.find(c => c.fechaEntregaEditor && !c.fechaEnvioAutor);
    const responsible = current ? EDITORIAL_RESPONSIBLE[current.state] : null;
    waiting = responsible === 'autor' ? 'Autor' : responsible === 'editor' ? 'Editor' : null;
    if(chapter)waiting=null;
    canAct = !!chapter || responsible === 'especialista' || !current;
    currentStep = chapter ? `Enviar capítulo ${chapter.numero} al Autor para feedback` : current?.state === 'Esperando autor' ? 'Esperando feedback del Autor' : current?.label ?? 'Coordinar estructura y extracciones';
    instruction = chapter ? 'La entrega editorial está registrada. Envía el capítulo al Autor; no es necesario marcar otra recepción.' : current ? `${current.editor ?? 'Editor asignado'} · ${current.state}. ${waiting ? 'Puedes trabajar otro proceso mientras esperas.' : 'Continúa la coordinación editorial correspondiente.'}` : 'Coordina estructura, extracciones y capítulos según la modalidad contratada.';
    complete = !!facts.p.fechaFeedbackTripa && editorial.every(i=>i.state === 'Completadas');
    const waitingChapter=facts.chapters.find(c=>c.fechaEnvioAutor&&!c.fechaRespuestaReal);
    waitingSince=waiting==='Autor'?iso(waitingChapter?.fechaEnvioAutor):iso(current?.startedAt??editor?.a.asignadoEn);
    dueAt=waiting==='Autor'?iso(waitingChapter?.fechaPautadaFeedback):iso(current?.dueDate);
    const received=facts.deliveries.find(d=>d.workItemId===current?.workItemId)??(chapter?facts.deliveries.find(d=>facts.works.some(w=>w.id===d.workItemId&&w.businessKey==='capitulo:'+chapter.id)):undefined);
    if(received) delivery={receivedAt:iso(received.submittedAt),url:received.driveUrl,label:chapter?`Entrega del capítulo ${chapter.numero}`:'Entrega editorial'};
    if(chapter)action={kind:'chapter_author',label:`Registrar envío del capítulo ${chapter.numero} al Autor`,chapter:chapter.numero};
   }
  } else if (process.tipo === 'correccion') {
   const c = facts.correction.find(c=>!c.resultado) ?? facts.correction[0];
   const decision=facts.decisions.find(d=>d.originCorreccionId===c?.id&&d.status!=='resuelta');
   const contract = c ? contracts.find(x=>x.correccionId===c.id) : undefined;
   requirements = c ? [req('review','Revisión previa de Jefatura, cuando aplica',!c.requiereRevisionPrevia || c.revisionPreviaConfirmada,'correcciones'),req('contract','Contrato confirmado para el corrector',c.contratoConfirmado,'contratos_correccion'),req('assignee','Corrector contactado y asignación formal',c.fechaAsignada,'correcciones'),req('word','Word con control de cambios recibido',c.controlCambiosUrl,'correcciones'),req('report','Informe técnico recibido',c.informeTecnicoUrl,'correcciones')] : [];
   complete = !!c?.resultado && !!c.controlCambiosUrl && !!c.informeTecnicoUrl;
   waiting = c?.requiereRevisionPrevia && !c.revisionPreviaConfirmada ? 'Jefatura' : contract && ['pendiente','en_revision'].includes(contract.estado) ? 'Talento Humano' : c?.fechaAsignada && !c.entregadoEn && !c.fechaEntrega ? 'Corrector externo' : null;
   canAct = !complete && !waiting;
   currentStep = !c ? 'Seleccionar y contactar Corrector' : !c.contratoConfirmado ? 'Gestionar contrato' : !c.fechaAsignada ? 'Formalizar asignación' : !c.fechaEntrega ? 'Esperar entregables' : !c.resultado ? 'Verificar Word e informe técnico' : 'Corrección completada';
   action={kind:!c?'correction_start':!c.contratoConfirmado?'correction_contract':!c.fechaAsignada?'correction_assign':'correction_review',targetId:c?.id,label:currentStep};
   instruction = waiting ? `Esperando a ${waiting}. Las entregas correlacionadas de Drive actualizan este proyecto automáticamente.` : 'Conserva el contrato y la asignación externa; revisa ambos entregables antes de calificar el resultado.';
   if(!c)instruction='No hay una intervención de Corrección iniciada. Define alcance y páginas para conocer sus requisitos y contactar al Corrector.';
   requestedAt=iso(c?.createdAt); assignedAt=iso(c?.asignadoEn??c?.fechaAsignada); assignee=c?.correctorNombre??assignments.find(a=>a.a.usuarioId===c?.correctorId)?.name??null;
   waitingSince=waiting==='Corrector externo'?assignedAt:waiting==='Talento Humano'?iso(contract?.requestedAt):requestedAt; dueAt=iso(c?.dueAt);
   if(c?.controlCambiosUrl) delivery={receivedAt:iso(c.entregadoEn??c.fechaEntrega),url:c.controlCambiosUrl,label:'Word con control de cambios'};
   if(decision?.status==='informacion_solicitada'){
    waiting=decision.requestedByUserId===specialist?null:'Especialista solicitante';canAct=!waiting;
    currentStep='Responder información solicitada por Jefatura';instruction=decision.requestedInfoMessage??'Completa la información requerida para la revisión previa.';
    action={kind:'decision_response',label:'Responder a Jefatura',targetId:decision.id};waitingSince=iso(decision.requestedInfoAt);
   }
  } else if (process.tipo === 'direccion_creativa') {
   const c = facts.creative.find(c=>c.tipo==='concepto_portada');
   const gate = evaluarGateMomentoReunionCreativa({ servicioCodigo: facts.serviceCode, tituloDefinitivo: facts.p.tituloDefinitivo, subtituloDefinitivo: facts.p.subtituloDefinitivo, fechaFeedbackTripa: facts.p.fechaFeedbackTripa });
   requirements = [req('title','Título y subtítulo definitivos',facts.p.tituloDefinitivo && facts.p.subtituloDefinitivo,'proyectos'),req('moment',gate.motivo ?? 'Hito editorial para reunión creativa',gate.desbloqueado,'evaluarGateMomentoReunionCreativa')];
   complete = creativeReady(facts);
   const creativeRequest = requests.find(r=>r.tipo==='creativa' && ['pendiente','en_revision'].includes(r.estado));
   const proposal=facts.proposals.filter(p=>p.direccionCreativaId===c?.id).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime())[0];
   waiting = c?.fechaBriefEnviadoAutor && !c.fechaBriefAprobadoAutor ? 'Autor' : c?.fechaBriefAprobadoAutor && proposal ? !proposal.fechaAprobadaRrpp?'RRPP':proposal.fechaEnviadaAutor&&!proposal.fechaAprobadaAutor?'Autor':proposal.fechaAprobadaAutor&&!complete?'Líder Creativo':null : c && (!c.briefEnlace || c.fechaBriefAprobadoAutor && !complete) || !c && creativeRequest ? 'Líder Creativo' : null;
   canAct = !complete && !waiting && requirements.every(r=>r.satisfied);
   currentStep = !c ? 'Solicitar reunión creativa' : !c.reunionRealizada ? 'Coordinar reunión creativa' : !c.fechaBriefEnviadoAutor ? 'Enviar brief al Autor' : !c.fechaBriefAprobadoAutor ? 'Esperar aprobación del brief' : 'Coordinar aprobación del concepto';
   if(proposal&&c?.fechaBriefAprobadoAutor) currentStep=!proposal.fechaAprobadaRrpp?'Esperar revisión del concepto por RRPP':!proposal.fechaEnviadaAutor?'Enviar concepto al Autor':!proposal.fechaAprobadaAutor?'Esperar aprobación del concepto por el Autor':'Recibir recursos creativos';
   requestedAt=iso(creativeRequest?.requestedAt??c?.fechaSolicitud);
   const creativeAssignment=assignments.find(a=>a.a.tipo==='lider_creativo'&&a.a.workItemId===c?.workItemId);
   assignedAt=iso(creativeAssignment?.a.asignadoEn); assignee=creativeAssignment?.name??null;
   waitingSince=waiting==='Autor'?iso(c?.fechaBriefAprobadoAutor?proposal?.fechaEnviadaAutor:c?.fechaBriefEnviadoAutor):waiting==='RRPP'?iso(proposal?.fechaEnviadaEspecialista):c?.fechaBriefAprobadoAutor?iso(proposal?.fechaAprobadaAutor??c.fechaBriefAprobadoAutor):assignedAt??requestedAt;
   if(c?.briefEnlace) delivery={receivedAt:iso(c.fechaBriefEnviadoEspecialista),url:c.briefEnlace,label:'Brief creativo'};
   if(c?.reunionRealizada&&c.briefEnlace&&!c.fechaBriefEnviadoAutor)action={kind:'brief_author',label:'Registrar envío del brief al Autor',targetId:c.id};
   if(proposal?.fechaAprobadaRrpp&&!proposal.fechaEnviadaAutor&&c?.fechaBriefAprobadoAutor){action={kind:'concept_author',label:'Registrar envío del concepto al Autor',targetId:proposal.id};if(proposal.enlace)delivery={receivedAt:iso(proposal.fechaEnviadaEspecialista),url:proposal.enlace,label:'Concepto aprobado por RRPP'};}
   instruction = process.motivoNoIniciado ?? 'Reunión, brief, concepto y recursos se conservan en el flujo creativo existente.';
   if(!c)action={kind:'creative_request',label:'Solicitar reunión creativa'};
  } else if (process.tipo === 'diseno') {
   const d = facts.designs.find(d=>!d.cerradoEn);
   const missingDesign=(['muestra_diagramacion','cubierta_extendida','diagramacion'] as const).find(type=>!currentDesignVersion(facts,type));
   const v = d ? facts.versions.find(v=>v.v.disenoId===d.id)?.v : undefined;
   const creative = creativeReady(facts);
   const sampleApproved = !!currentDesignVersion(facts, 'muestra_diagramacion')?.aprobadaAutorEn;
   requirements = [req('title','Título y subtítulo definitivos',facts.p.tituloDefinitivo && facts.p.subtituloDefinitivo,'proyectos'),req('concept','Concepto aprobado, brief y recursos creativos',creative,'direcciones_creativas')];
   steps = [step('muestra','Preparar muestra y cubierta',requirements),step('diagramacion','Solicitar diagramación completa',[...requirements,req('correction','Tripa corregida entregada',facts.correction.some(c=>c.alcance==='tripa_completa'&&c.fechaEntrega),'correcciones'),req('sample','Muestra aprobada por Autor',sampleApproved,'diseno_versiones')])];
   if(d?.tipo==='diagramacion'||!d&&missingDesign==='diagramacion') requirements=steps[1]!.requirements;
   currentStep = !d ? 'Preparar muestra de diagramación / cubierta' : !d.externalProviderEmail ? 'Configurar proveedor externo' : !v || v.feedbackEn ? 'Esperar versión de Diseño' : v.enviadaAutorEn && !v.aprobadaAutorEn ? 'Esperar aprobación del Autor' : 'Coordinar la versión entregada';
   if(!d)currentStep=missingDesign==='cubierta_extendida'?'Solicitar cubierta extendida':missingDesign==='diagramacion'?'Solicitar diagramación completa':'Solicitar muestra de diagramación';
   waiting = d?.externalProviderEmail && (!v || v.feedbackEn) ? 'Diseño externo' : v?.enviadaAutorEn && !v.aprobadaAutorEn ? 'Autor' : null;
   complete = ['muestra_diagramacion','cubierta_extendida','diagramacion'].every(type=>{
    const design=facts.designs.find(d=>d.tipo===type),version=currentDesignVersion(facts,type); return design?.cerradoEn && version && !version.feedbackEn;
   });
   if(complete)currentStep='Diseño y diagramación completados';
   canAct = !complete && !waiting && requirements.every(r=>r.satisfied);
   instruction = 'Cada entregable conserva sus gates: la diagramación completa requiere corrección, evidencia de Edición y muestra aprobada. Diseño entrega en Drive.';
   requestedAt=iso(d?.solicitadoEn); assignee=d?.externalProviderName??null; dueAt=iso(d?.dueAt);
   waitingSince=waiting==='Autor'?iso(v?.enviadaAutorEn):requestedAt;
   if(waiting==='Autor')dueAt=iso(v?.feedbackAutorDueAt);
   if(v?.enlace)delivery={receivedAt:iso(v.entregadoEn),url:v.enlace,label:`Versión ${v.numero} de Diseño`};
   action={kind:'native',label:currentStep,targetId:d?.id,designType:missingDesign};
  } else if (['calidad','validacion_cubierta'].includes(process.tipo)) {
   const version=currentDesignVersion(facts,process.tipo==='calidad'?'diagramacion':'cubierta_extendida');
   const coverWork=version?facts.works.find(w=>w.tipo==='validacion_cubierta'&&w.businessKey===version.id):undefined;
   const round=process.tipo==='calidad'?facts.quality.find(q=>q.id===version?.calidadFaseId):coverWork?.observaciones?coverRound(coverWork):undefined;
   const validator=assignments.find(a=>a.a.tipo==='validador'&&a.a.workItemId===round?.workItemId);
   const requested=!round?undefined:round.aprobado?'Todos los comentarios aplicados':round.revisadoEn||version?.feedbackEn?'Esperando nueva versión de Diseño':round.iniciadoEn?'Validador revisando':validator?'Esperando revisión del Validador':round.validatorRequestedAt?'Esperando asignación de Jefatura':'Solicitar Validador';
   requirements = [req('version','Versión de Diseño disponible',round,'work_items / diseno_versiones'),req('validator','Validador asignado por Jefatura',validator,'project_assignments')];
   waiting = requested?.includes('nueva versión') ? 'Diseño externo' : requested?.includes('asignación') ? 'Jefatura' : requested?.includes('revisión') || requested?.includes('revisando') ? 'Validador' : null;
   complete = requested === 'Todos los comentarios aplicados';
   currentStep = requested ?? 'Recibir versión de Diseño';
   canAct = !!round && !waiting && !complete;
   if (process.tipo === 'calidad') {
    const d = facts.designs.find(d=>d.tipo==='diagramacion');
    const v = d ? facts.versions.find(x=>x.v.disenoId===d.id)?.v : undefined;
    const q = v ? facts.quality.find(q=>q.id===v.calidadFaseId) : undefined;
    if (q?.aprobado && q.numeroFase < 3 && v) {
     complete = false;
     waiting = v.enviadaAutorEn && !v.aprobadaAutorEn ? 'Autor' : null;
     canAct = !waiting;
     currentStep = v.aprobadaAutorEn ? 'Solicitar Revisión Final' : v.enviadaAutorEn ? 'Esperar aprobación del Autor' : 'Enviar versión validada al Autor';
    }
   }
   action = { kind: 'validation', label: actor.rol==='jefe_area' ? 'Asignar Validador' : complete ? 'Continuar coordinación con Autor' : 'Solicitar Validador' };
   if(process.tipo==='calidad'&&round?.aprobado&&!complete)action={kind:'native',label:currentStep,targetId:round.id};
   instruction = waiting ? `Esperando a ${waiting}. Los comentarios y nuevas versiones actualizan la guía; puedes elegir otro proceso.` : 'Solicita el Validador o continúa con el Autor y Revisión Final cuando la versión esté aprobada.';
   requestedAt=iso(round?.validatorRequestedAt); assignedAt=iso(validator?.a.asignadoEn); assignee=validator?.name??null;
   waitingSince=waiting==='Autor'?iso(version?.enviadaAutorEn):waiting==='Validador'?assignedAt:requestedAt;
   dueAt=waiting==='Autor'?iso(version?.feedbackAutorDueAt):iso(round?.dueAt);
   if(version)delivery={receivedAt:iso(version.entregadoEn),url:version.enlace,label:`Versión ${version.numero} para ${process.nombre}`};
  } else if (process.activacion) {
   requirements = [req('activation',process.activacion.gate.motivo,process.activacion.gate.desbloqueado,'gate de activación canónico')];
   const requestState = process.activacion.solicitud?.estado;
   const needsResponse = requestState === 'requiere_informacion';
   const pending = requestState === 'pendiente' || requestState === 'en_revision';
   waiting = pending || process.activacion.activo && !complete ? 'RRPP' : null;
   canAct = !waiting && !complete && process.activacion.gate.desbloqueado;
   currentStep = needsResponse ? 'Responder solicitud de RRPP' : waiting ? 'Esperando a RRPP' : process.nombre;
   requestedAt=process.activacion.solicitud?.requestedAt??null;
   waitingSince=requestedAt;assignee=process.activacion.operadoPor??null;
  } else {
   const live = process.trabajos.filter(w=>!['completado','cancelado'].includes(w.estado));
   waiting = live.length && process.ownerRole !== 'especialista' ? person : null;
   const liveAssignment=assignments.find(a=>live.some(w=>w.id===a.a.workItemId));
   assignedAt=iso(liveAssignment?.a.asignadoEn);assignee=liveAssignment?.name??null;
   waitingSince=assignedAt??iso(live[0]?.inicio);dueAt=iso(live[0]?.vence);
   requirements = process.motivoNoIniciado ? [req('native',process.motivoNoIniciado,!!process.trabajos.length,'proyección canónica del proceso')] : [];
   canAct = !waiting && !complete && process.ownerRole === 'especialista' && !!process.action;
   if(live.some(w=>w.estado==='bloqueado')) {
    waiting=null; canAct=false;
    requirements.push(req('block',live.find(w=>w.estado==='bloqueado')?.gate??'Resolver el bloqueo registrado en este proceso',false,'work_items.gate_bloqueante'));
   }
  }
  const unsafeHistory = process.tipo === 'preparacion_inicial' && downstream;
  if(process.tipo !== 'preparacion_inicial' && !completedPreparation && !downstream) {
   requirements.unshift(req('preparation','Completar Preparación inicial',false,'preparaciones_proyecto / project_drive_workspaces'));
   canAct=false; waiting=null;
  }
  if(!specialist){requirements.unshift(req('specialist','Asignar Especialista antes de activar procesos',false,'project_assignments / proyectos'));canAct=false;waiting=null;}
  if (complete) { waiting = null; canAct = false; }
  if(!complete&&!dueAt){const current=process.trabajos.find(w=>!['completado','cancelado'].includes(w.estado));dueAt=iso(current?.vence);}
  if(!complete && !waiting && !canAct && requirements.every(r=>r.satisfied)) requirements.push(req('operation',process.motivoNoIniciado ?? 'Este proceso no tiene una operación pendiente para el Especialista',false,'proceso canónico'));
  if (!steps.length) steps = [step(process.tipo,currentStep,requirements)];
  const state = complete ? 'Completado' : waiting ? 'Esperando tercero' : !canAct && requirements.some(r=>!r.satisfied) ? 'Bloqueado' : process.trabajos.length ? 'En curso' : 'Disponible';
  paths.push({ id: process.tipo, label: process.nombre, state, currentStep, instruction, responsible: waiting ?? (canAct ? 'Especialista' : person), waitingFor: waiting, requirements, steps,
   requestedAt, assignedAt, assignee, waitingSince:waiting?waitingSince:null, dueAt:complete?null:dueAt, delivery,
   blockingReasons:state==='Bloqueado'?requirements.filter(r=>!r.satisfied).map(r=>r.label):[],
   canContinue: requirements.every(r=>r.satisfied) && !waiting && editable && !unsafeHistory && (canAct || complete),
   requiresAction: canAct && !unsafeHistory,
   canOperate: canAct && editable && !unsafeHistory, action: editable && canAct ? action : null,
   historicalReadOnly: unsafeHistory || !editable || complete && process.tipo !== 'preparacion_inicial',
   editWarning: unsafeHistory ? 'Este cambio puede afectar procesos posteriores. Los datos sensibles quedan de solo lectura porque no existe invalidación automática segura.' : null });
 }
 // Main production line follows editorial progress, never the viewer's action queue.
 const active = !specialist?undefined:paths.find(p=>p.id==='preparacion_inicial' && p.state!=='Completado' && !downstream) ?? paths.find(p=>p.id!=='preparacion_inicial'&&p.state!=='Completado');
 const supervisionActions:ProjectGuide['supervisionActions']=!['culminado','retirado'].includes(facts.p.estado)?[
  ...(!specialist&&facts.p.notificadoJefatura?[{id:id+':specialist',processId:null,label:'Asignar Especialista para comenzar la gestión',href:'/?vista=asignaciones&proyecto='+id,kind:'assignment' as const}]:[]),
  ...paths.filter(p=>p.waitingFor==='Jefatura'&&['calidad','validacion_cubierta'].includes(p.id)).map(p=>({id:id+':'+p.id,processId:p.id,label:'Asignar Validador · '+p.label,href:'/proyectos/'+id+'?proceso='+p.id,kind:'assignment' as const})),
  ...facts.decisions.filter(d=>['pendiente','en_revision'].includes(d.status)).map(d=>({id:d.id,processId:d.originCorreccionId?'correccion':'calidad',label:d.subject,href:'/?vista=decisiones&decision='+d.id,kind:'decision' as const})),
 ]:[];
 return { paths, finalPackage, supervisionActions,
  priorityAction:paths.find(p=>p.canOperate)?.id??null, requiresUserAction:paths.some(p=>p.canOperate),
  waitingOn:paths.filter(p=>p.waitingFor).map(p=>({processId:p.id,actor:p.waitingFor!})),
  availableProcesses:paths.filter(p=>p.requiresAction).map(p=>p.id), blockedProcesses:paths.filter(p=>p.state==='Bloqueado').map(p=>p.id),
  activeProcesses:paths.filter(p=>['En curso','Esperando tercero'].includes(p.state)).map(p=>p.id),
  nextMilestones:paths.filter(p=>p.state!=='Completado'&&p.state!=='Bloqueado').map(p=>({processId:p.id,label:p.waitingFor?'Recibir respuesta de '+p.waitingFor:p.currentStep,dueAt:p.dueAt})),
  currentPath: active?.id ?? null, position: !specialist?'Esperando asignaci\u00f3n de Especialista':active?.currentStep ?? 'Procesos editoriales completados', nextMilestone: finalPackage.canPrepare ? finalPackage.prepared ? finalPackage.financialSatisfied ? 'Liberar Paquete Final' : 'Confirmar solvencia administrativa para liberar Paquete Final' : 'Preparar Paquete Final' : active?.waitingFor ? `Recibir respuesta de ${active.waitingFor}` : active?.currentStep ?? 'Consultar expediente', mode: actor.rol==='especialista' ? 'operate' : 'supervise', editable };
}
