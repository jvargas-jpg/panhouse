import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contratosCorreccion, projectAssignments, solicitudesArea, users } from '../db/schema/index.js';
import type { ProjectCommandCenter } from '../../shared/projectCommandCenter.js';
import type { GuidePath, GuideRequirement, GuideStep, ProjectGuide } from '../../shared/projectGuide.js';
import type { Rol } from '../db/schema/index.js';
import { finalPackageGate, projectWorkflowFacts, requirement as req } from './finalPackage.js';
import { editorialInterventions, EDITORIAL_RESPONSIBLE } from './editorialChief.js';
import { evaluarGateMomentoReunionCreativa } from './gates.js';

type Context = Pick<ProjectCommandCenter, 'preparacion' | 'procesos' | 'datosEditoriales' | 'ficha'>;
export async function projectGuide(id: string, data: Context, actor: { id: string; rol: Rol }): Promise<ProjectGuide> {
 const facts = await projectWorkflowFacts(id);
 const [editorial, requests, assignments, contracts, finalPackage] = await Promise.all([
  editorialInterventions(undefined, id),
  db.select().from(solicitudesArea).where(eq(solicitudesArea.proyectoId, id)).orderBy(desc(solicitudesArea.requestedAt)),
  db.select({ a: projectAssignments, name: users.nombre }).from(projectAssignments).innerJoin(users, eq(users.id, projectAssignments.usuarioId)).where(and(eq(projectAssignments.proyectoId, id), isNull(projectAssignments.finalizadoEn))).orderBy(desc(projectAssignments.asignadoEn)),
  db.select().from(contratosCorreccion).orderBy(desc(contratosCorreccion.ronda)),
  finalPackageGate(id, db, facts),
 ]);
 const editable = actor.rol === 'especialista' && ['en_proceso','retrasado'].includes(facts.p.estado);
 const p = data.preparacion;
 const step = (id: string, label: string, requirements: GuideRequirement[]): GuideStep => ({ id, label, requirements, completed: requirements.every(r => r.satisfied) });
 const preparation = [
  step('recepcion', 'Recibir y revisar expediente', [req('received','Proyecto recibido',p.recibidoEn,'preparaciones_proyecto'),req('reviewed','Expediente revisado',p.expedienteRevisadoEn,'preparaciones_proyecto')]),
  step('contacto', 'Primer contacto', [req('contact','Primer contacto realizado',p.primerContactoEn,'preparaciones_proyecto')]),
  step('reunion', 'Reunión operativa', [req('meeting','Reunión realizada',p.reunionOperativaRealizada,'preparaciones_proyecto')]),
  step('documentos', 'Organizar documentos', [req('drive','Drive del proyecto disponible',p.driveEstado === 'configurado','project_drive_workspaces'),...(['minutaUrl','cronogramaUrl','grabacionUrl','transcripcionUrl'] as const).map((key,i)=>req(key,['Minuta','Cronograma','Grabación','Transcripción'][i]!,p[key],'preparaciones_proyecto'))]),
 ];
 const completedPreparation = preparation.every(s => s.completed);
 const paths: GuidePath[] = [];
 for (const process of data.procesos.filter(pr => pr.estado !== 'No aplica')) {
  let requirements: GuideRequirement[] = [], steps: GuideStep[] = [], waiting: string | null = null;
  let instruction = process.detalle, currentStep = process.nombre;
  let complete = process.estado === 'Completo', canAct = false;
  let action: GuidePath['action'] = { kind: 'native', label: 'Completar este paso' };
  const person = assignments.find(x => x.a.tipo === process.ownerRole && (!x.a.workItemId || process.trabajos.some(w=>w.id===x.a.workItemId)))?.name ?? process.assignee ?? process.ownerLabel ?? 'Especialista';
  if (process.tipo === 'preparacion_inicial') {
   steps = preparation; const current = preparation.find(s => !s.completed) ?? preparation.at(-1)!;
   requirements = current.requirements; currentStep = current.label; complete = completedPreparation;
   instruction = complete ? 'Preparación completada. Elige un proceso disponible.' : 'Completa los requisitos de este paso. Los datos se guardan también en el expediente.';
   canAct = !complete;
  } else if (process.tipo === 'edicion') {
   const editor = assignments.find(a => a.a.tipo === 'editor' && !a.a.workItemId);
   const assigned = !!editor || !!facts.p.editorId;
   const requested = requests.find(r => r.tipo === 'editor' && !['cancelada','rechazada'].includes(r.estado));
   requirements = [req('editor','Editor asignado por Jefatura de Edición',assigned,'project_assignments'),req('manuscript','Material editorial disponible',facts.p.manuscritoUrl || facts.chapters.length,'proyectos / capitulos')];
   if (!assigned) {
    waiting = requested ? 'Jefatura de Edición' : null; canAct = !requested;
    currentStep = requested ? 'Esperando asignación de Jefatura de Edición' : 'Solicitar Editor';
    instruction = requested ? `Solicitud enviada el ${requested.requestedAt.toISOString().slice(0,10)}. No necesitas hacer nada aquí por ahora.` : 'Solicita Editor dentro de este proyecto. Jefatura de Edición asigna según carga.';
    action = { kind: 'request_editor', label: 'Solicitar Editor' };
   } else {
    const current = editorial.find(i => i.state === 'Esperando Especialista') ?? editorial.find(i => i.state !== 'Completadas');
    const chapter = facts.chapters.find(c => c.fechaEntregaEditor && !c.fechaEnvioAutor);
    const responsible = current ? EDITORIAL_RESPONSIBLE[current.state] : null;
    waiting = responsible === 'autor' ? 'Autor' : responsible === 'editor' ? 'Editor' : null;
    canAct = !!chapter || responsible === 'especialista' || !current;
    currentStep = chapter ? `Enviar capítulo ${chapter.numero} al Autor para feedback` : current?.state === 'Esperando autor' ? 'Esperando feedback del Autor' : current?.label ?? 'Coordinar estructura y extracciones';
    instruction = chapter ? 'La entrega editorial está registrada. Envía el capítulo al Autor; no es necesario marcar otra recepción.' : current ? `${current.editor ?? 'Editor asignado'} · ${current.state}. ${waiting ? 'Puedes trabajar otro proceso mientras esperas.' : 'Continúa la coordinación editorial correspondiente.'}` : 'Coordina estructura, extracciones y capítulos según la modalidad contratada.';
    complete = !!facts.p.fechaFeedbackTripa && editorial.every(i=>i.state === 'Completadas');
   }
  } else if (process.tipo === 'correccion') {
   const c = facts.correction.find(c=>!c.resultado) ?? facts.correction.at(-1);
   const contract = c ? contracts.find(x=>x.correccionId===c.id) : undefined;
   requirements = c ? [req('review','Revisión previa de Jefatura, cuando aplica',!c.requiereRevisionPrevia || c.revisionPreviaConfirmada,'correcciones'),req('contract','Contrato confirmado para el corrector',c.contratoConfirmado,'contratos_correccion'),req('assignee','Corrector contactado y asignación formal',c.fechaAsignada,'correcciones'),req('word','Word con control de cambios recibido',c.controlCambiosUrl,'correcciones'),req('report','Informe técnico recibido',c.informeTecnicoUrl,'correcciones')] : [req('tripa','Tripa editada con feedback del Autor',facts.p.fechaFeedbackTripa,'proyectos.fechaFeedbackTripa')];
   complete = !!c?.resultado && !!c.controlCambiosUrl && !!c.informeTecnicoUrl;
   waiting = c?.requiereRevisionPrevia && !c.revisionPreviaConfirmada ? 'Jefatura' : contract && ['pendiente','en_revision'].includes(contract.estado) ? 'Talento Humano' : c?.fechaAsignada && !c.entregadoEn && !c.fechaEntrega ? 'Corrector externo' : null;
   canAct = !complete && !waiting;
   currentStep = !c ? 'Seleccionar y contactar Corrector' : !c.contratoConfirmado ? 'Gestionar contrato' : !c.fechaAsignada ? 'Formalizar asignación' : !c.fechaEntrega ? 'Esperar entregables' : !c.resultado ? 'Verificar Word e informe técnico' : 'Corrección completada';
   instruction = waiting ? `Esperando a ${waiting}. Las entregas correlacionadas de Drive actualizan este proyecto automáticamente.` : 'Conserva el contrato y la asignación externa; revisa ambos entregables antes de calificar el resultado.';
  } else if (process.tipo === 'direccion_creativa') {
   const c = facts.creative.filter(c=>c.tipo==='concepto_portada').at(-1);
   const gate = evaluarGateMomentoReunionCreativa({ servicioCodigo: data.ficha.project.service.split(' ')[0], tituloDefinitivo: facts.p.tituloDefinitivo, subtituloDefinitivo: facts.p.subtituloDefinitivo, fechaFeedbackTripa: facts.p.fechaFeedbackTripa });
   requirements = [req('title','Título y subtítulo definitivos',facts.p.tituloDefinitivo && facts.p.subtituloDefinitivo,'proyectos'),req('moment',gate.motivo ?? 'Hito editorial para reunión creativa',gate.desbloqueado,'evaluarGateMomentoReunionCreativa')];
   complete = c?.resultadoFinal === 'aprobado';
   waiting = c?.fechaBriefEnviadoAutor && !c.fechaBriefAprobadoAutor ? 'Autor' : c && !c.briefEnlace ? 'Líder Creativo' : null;
   canAct = !complete && !waiting && requirements.every(r=>r.satisfied);
   currentStep = !c ? 'Solicitar reunión creativa' : !c.reunionRealizada ? 'Coordinar reunión creativa' : !c.fechaBriefEnviadoAutor ? 'Enviar brief al Autor' : !c.fechaBriefAprobadoAutor ? 'Esperar aprobación del brief' : 'Coordinar aprobación del concepto';
   instruction = process.motivoNoIniciado ?? 'Reunión, brief, concepto y recursos se conservan en el flujo creativo existente.';
  } else if (process.tipo === 'diseno') {
   const d = facts.designs.find(d=>!d.cerradoEn) ?? facts.designs.at(-1);
   const v = d ? facts.versions.find(v=>v.v.disenoId===d.id)?.v : undefined;
   const creative = facts.creative.some(c=>c.tipo==='concepto_portada' && c.resultadoFinal==='aprobado' && c.fechaBriefAprobadoAutor && c.recursoImagenUrl && c.recursoConceptoPdfUrl);
   const sampleApproved = facts.versions.some(v=>v.type==='muestra_diagramacion' && v.v.aprobadaAutorEn);
   requirements = [req('title','Título y subtítulo definitivos',facts.p.tituloDefinitivo && facts.p.subtituloDefinitivo,'proyectos'),req('concept','Concepto aprobado, brief y recursos creativos',creative,'direcciones_creativas')];
   steps = [step('muestra','Preparar muestra y cubierta',requirements),step('diagramacion','Solicitar diagramación completa',[...requirements,req('correction','Tripa corregida entregada',facts.correction.some(c=>c.alcance==='tripa_completa'&&c.fechaEntrega),'correcciones'),req('sample','Muestra aprobada por Autor',sampleApproved,'diseno_versiones')])];
   currentStep = !d ? 'Preparar muestra de diagramación / cubierta' : !d.externalProviderEmail ? 'Configurar proveedor externo' : !v || v.feedbackEn ? 'Esperar versión de Diseño' : v.enviadaAutorEn && !v.aprobadaAutorEn ? 'Esperar aprobación del Autor' : 'Coordinar la versión entregada';
   waiting = d?.externalProviderEmail && (!v || v.feedbackEn) ? 'Diseño externo' : v?.enviadaAutorEn && !v.aprobadaAutorEn ? 'Autor' : null;
   canAct = !waiting && requirements.every(r=>r.satisfied); complete = false;
   instruction = 'Cada entregable conserva sus gates: la diagramación completa requiere corrección, evidencia de Edición y muestra aprobada. Diseño entrega en Drive.';
  } else if (['calidad','validacion_cubierta'].includes(process.tipo)) {
   const requested = process.seguimiento?.find(f=>f.key==='estado')?.value as string | undefined;
   requirements = [req('version','Versión de Diseño disponible',process.trabajos.length,'work_items / diseno_versiones'),req('validator','Validador asignado por Jefatura',process.assignee,'project_assignments')];
   waiting = requested?.includes('nueva versión') ? 'Diseño externo' : requested?.includes('asignación') ? 'Jefatura' : requested?.includes('revisión') || requested?.includes('revisando') ? 'Validador' : null;
   complete = requested === 'Todos los comentarios aplicados';
   currentStep = requested ?? process.motivoNoIniciado ?? 'Recibir versión de Diseño';
   canAct = !!process.trabajos.length && !waiting;
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
   instruction = waiting ? `Esperando a ${waiting}. Los comentarios y nuevas versiones actualizan la guía; puedes elegir otro proceso.` : 'Solicita el Validador o continúa con el Autor y Revisión Final cuando la versión esté aprobada.';
  } else if (process.activacion) {
   requirements = [req('activation',process.activacion.gate.motivo,process.activacion.gate.desbloqueado,'gate de activación canónico')];
   waiting = process.activacion.solicitud && !process.activacion.activo ? 'RRPP' : process.activacion.activo && !complete ? 'RRPP' : null;
   canAct = !waiting && !complete && process.activacion.gate.desbloqueado;
   currentStep = waiting ? 'Esperando a RRPP' : process.nombre;
  } else {
   const live = process.trabajos.filter(w=>!['completado','cancelado'].includes(w.estado));
   waiting = live.length && process.ownerRole !== 'especialista' ? person : null;
   requirements = process.motivoNoIniciado ? [req('native',process.motivoNoIniciado,!!process.trabajos.length,'proyección canónica del proceso')] : [];
   canAct = !waiting && !complete && !!process.action;
  }
  const unsafeHistory = process.tipo === 'preparacion_inicial' && facts.works.some(w=>!['intake_rrpp','asignacion_especialista','preparacion_inicial'].includes(w.tipo));
  if (complete) { waiting = null; canAct = false; }
  if (!steps.length) steps = [step(process.tipo,currentStep,requirements)];
  const state = complete ? 'Completado' : waiting ? 'Esperando tercero' : !canAct && requirements.some(r=>!r.satisfied) ? 'Bloqueado' : process.trabajos.length ? 'En curso' : 'Disponible';
  paths.push({ id: process.tipo, label: process.nombre, state, currentStep, instruction, responsible: waiting ?? (canAct ? 'Especialista' : person), waitingFor: waiting, requirements, steps,
   canContinue: requirements.every(r=>r.satisfied) && !waiting && editable,
   canOperate: canAct && editable && !unsafeHistory, action: editable && canAct ? action : null,
   historicalReadOnly: unsafeHistory || !editable || complete,
   editWarning: unsafeHistory ? 'Este cambio puede afectar procesos posteriores. Los datos sensibles quedan de solo lectura porque no existe invalidación automática segura.' : null });
 }
 const active = paths.find(p=>p.id==='preparacion_inicial' && p.state!=='Completado' && !p.historicalReadOnly) ?? paths.find(p=>p.canOperate) ?? paths.find(p=>p.waitingFor) ?? paths.find(p=>p.state!=='Completado');
 return { paths, finalPackage, currentPath: active?.id ?? null, position: active?.currentStep ?? 'Procesos editoriales completados', nextMilestone: finalPackage.canPrepare ? finalPackage.prepared ? 'Liberar Paquete Final' : 'Preparar Paquete Final' : active?.waitingFor ? `Recibir respuesta de ${active.waitingFor}` : active?.currentStep ?? 'Consultar expediente', mode: actor.rol==='especialista' ? 'operate' : 'supervise', editable };
}
