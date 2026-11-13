import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { capitulos, correcciones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichaDocumentalDatos, fichasTrazabilidad, fases, pasos, projectDriveFolders, projectDriveWorkspaces, proyectos, servicioFases, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import type { FinalPackageGate, GuideRequirement } from '../../shared/projectGuide.js';
import { getProjectFinancialStatus } from './estadoFinanciero.js';

export const requirement = (id: string, label: string, value: unknown, source: string): GuideRequirement => ({ id, label, satisfied: !!value, source });
// One fact loader feeds the guide and the existing package write guard.
export async function projectWorkflowFacts(id: string, client: typeof db | Tx = db) {
  const [p] = await client.select().from(proyectos).where(eq(proyectos.id, id));
  if (!p) throw Object.assign(new Error('Proyecto no encontrado'), { statusCode: 404 });
  const reads = [
    client.select().from(correcciones).where(eq(correcciones.proyectoId, id)),
    client.select().from(direccionesCreativas).where(eq(direccionesCreativas.proyectoId, id)),
    client.select().from(disenos).where(eq(disenos.proyectoId, id)),
    client.select({ v: disenoVersiones, type: disenos.tipo }).from(disenoVersiones).innerJoin(disenos, eq(disenos.id, disenoVersiones.disenoId)).where(eq(disenos.proyectoId, id)).orderBy(desc(disenoVersiones.numero)),
    client.select({ q: fichaCalidadFases }).from(fichaCalidadFases).innerJoin(fichasTrazabilidad, eq(fichasTrazabilidad.id, fichaCalidadFases.fichaId)).where(eq(fichasTrazabilidad.proyectoId, id)),
    client.select().from(capitulos).where(eq(capitulos.proyectoId, id)),
    client.select().from(workItems).where(eq(workItems.proyectoId, id)),
    client.select({ code: fases.codigo, id: fases.id, name: fases.nombre }).from(servicioFases).innerJoin(fases, eq(fases.id, servicioFases.faseId)).where(and(eq(servicioFases.servicioId, p.servicioId), eq(servicioFases.activo, true), eq(fases.activo, true))),
    client.select({ key: projectDriveFolders.key }).from(projectDriveFolders).innerJoin(projectDriveWorkspaces, eq(projectDriveWorkspaces.id, projectDriveFolders.workspaceId)).where(and(eq(projectDriveWorkspaces.projectId, id), eq(projectDriveWorkspaces.status, 'READY'), eq(projectDriveFolders.status, 'READY'))),
    client.select().from(fichaDocumentalDatos).where(and(eq(fichaDocumentalDatos.proyectoId, id), eq(fichaDocumentalDatos.seccion, 'diseno'))),
    client.select().from(pasos),
  ] as const;
  const [correction, creative, designs, versions, quality, chapters, works, configuration, folders, documents, steps] = client === db ? await Promise.all(reads) : [await reads[0],await reads[1],await reads[2],await reads[3],await reads[4],await reads[5],await reads[6],await reads[7],await reads[8],await reads[9],await reads[10]];
  return { p, correction, creative, designs, versions, quality: quality.map(r => r.q), chapters, works, configuration, folders, documents: documents[0]?.datos ?? {}, steps };
}
export type WorkflowFacts = Awaited<ReturnType<typeof projectWorkflowFacts>>;
export function editorialPackageRequirements(f: WorkflowFacts): { requirements: GuideRequirement[]; configurationSource: FinalPackageGate['configurationSource'] } {
  const requirements: GuideRequirement[] = [];
  const folders = new Set(f.folders.map(x => x.key));
  const codes = new Set(f.configuration.map(x => x.code));
  const source = codes.size ? 'service_configuration' : folders.has('FINAL_PACKAGE') ? 'persisted_workspace' : 'unconfirmed';
  if (source === 'unconfirmed') requirements.push(requirement('configuration', 'Confirmar configuración editorial aplicable al servicio', false, 'servicio_fases / workspace persistido'));
  const applies = (type: string, folder: string) => codes.size ? codes.has(type) : folders.has(folder);
  if (applies('edicion', 'EDITING')) requirements.push(requirement('editing', 'Edición y feedback de tripa completados', f.p.fechaFeedbackTripa && !f.works.some(w => w.tipo === 'edicion' && ['pendiente','en_progreso','bloqueado'].includes(w.estado)), 'proyectos.fechaFeedbackTripa / work_items'));
  if (applies('correccion', 'CORRECTION')) requirements.push(requirement('correction', 'Tripa corregida con Word e informe técnico', f.correction.some(c => c.alcance === 'tripa_completa' && c.fechaEntrega && c.controlCambiosUrl && c.informeTecnicoUrl), 'correcciones'));
  if (applies('direccion_creativa', 'CREATIVE') || codes.has('diseno') || folders.has('DESIGN')) requirements.push(requirement('creative', 'Concepto creativo aprobado y recursos entregados', f.creative.some(c => c.tipo === 'concepto_portada' && c.resultadoFinal === 'aprobado' && c.fechaBriefAprobadoAutor && c.recursoImagenUrl && c.recursoConceptoPdfUrl), 'direcciones_creativas'));
  const latest = f.designs.filter(d => d.tipo === 'diagramacion').map(d => f.versions.find(v => v.v.disenoId === d.id)?.v).filter(v => !!v);
  if (applies('diseno', 'DESIGN')) requirements.push(requirement('design', 'Diagramación entregada', latest.length, 'diseno_versiones'));
  if (applies('calidad', 'QUALITY_COMMENTS')) {
    requirements.push(requirement('author', 'Autor aprobó la versión vigente', latest.length && latest.every(v => !!v.aprobadaAutorEn && !v.feedbackEn), 'diseno_versiones.aprobadaAutorEn')); 
    requirements.push(requirement('final-review', 'Revisión Final aprobada sobre la versión vigente', latest.length && latest.every(v => f.quality.some(q => q.id === v.calidadFaseId && q.numeroFase >= 3 && q.aprobado === true && q.revisadoEn)), 'ficha_calidad_fases / versión vigente')); 
  }
  // Unknown configured editorial phases fail closed unless their own linked work proves completion.
  const known = new Set(['proyecto','ingreso','intake_rrpp','asignacion_especialista','preparacion_inicial','edicion','correccion','direccion_creativa','diseno','calidad','digital','soporte_digital','lanzamiento','impresion','distribucion']);
  for (const config of f.configuration.filter(c => !known.has(c.code))) {
    const stepIds = f.steps.filter(s => s.faseId === config.id).map(s => s.id);
    const works = f.works.filter(w => w.tipo === config.code || w.pasoId && stepIds.includes(w.pasoId));
    requirements.push(requirement('config-'+config.id, config.name, works.length && works.every(w => ['completado','cancelado'].includes(w.estado)) && works.some(w => w.estado === 'completado'), 'servicio_fases / pasos / work_items'));
  }
  if (!requirements.length) requirements.push(requirement('definition', 'Definir requisitos editoriales de convergencia para este servicio', false, 'servicio_fases'));
  return { requirements, configurationSource: source };
}
export async function finalPackageGate(id: string, client: typeof db | Tx = db, facts?: WorkflowFacts): Promise<FinalPackageGate> {
  const f = facts ?? await projectWorkflowFacts(id, client);
  const { requirements, configurationSource } = editorialPackageRequirements(f);
  const financial = await getProjectFinancialStatus(id, client);
  const canPrepare = requirements.every(r => r.satisfied);
  const prepared = f.documents.paqueteFinalCargado === true;
  return { requirements, configurationSource, canPrepare, prepared, financialSatisfied: financial?.gateSatisfied === true,
    canRelease: canPrepare && prepared && financial?.gateSatisfied === true,
    financialMessage: financial?.gateSatisfied ? 'Liberación administrativa habilitada' : 'No hay solvencia administrativa confirmada. Solicita revisión a Comercial, responsable actual de la aprobación; Cobranzas verifica los pagos.' };
}
