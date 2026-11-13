import { eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from '../db/client.js';
import { decisiones, editorialDeliveries, capitulos, contratosCorreccion, correcciones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichaDisenoPropuestas, fichaDocumentalDatos, fichasTrazabilidad, fases, pasos, preparacionesProyecto, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, reunionesExtraccion, servicios, servicioFases, solicitudesArea, users, workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';
import type { FinalPackageGate, GuideRequirement } from '../../shared/projectGuide.js';
import { getProjectFinancialStatus } from './estadoFinanciero.js';

export const requirement = (id: string, label: string, value: unknown, source: string): GuideRequirement => ({ id, label, satisfied: !!value, source });
// Correlated aggregates keep one database round trip, even for portfolio reads.
// Decode with the schema's column codecs so timestamps stay Dates (as in select()).
function factRows<T extends PgTable>(table: T, condition: SQL, order?: SQL) {
  const columns = getTableColumns(table);
  const fields = Object.entries(columns).flatMap(([key, column]) => [sql`${key}::text`, sql`${column}`]);
  return sql<T['$inferSelect'][]>`(select coalesce(jsonb_agg(jsonb_build_object(${sql.join(fields, sql`, `)}) ${order ? sql`order by ${order}` : sql``}), '[]'::jsonb) from ${table} where ${condition})`
    .mapWith((value: Record<string, unknown>[]) => value.map(row => Object.fromEntries(Object.entries(columns).map(([key, column]) => [key, row[key] == null ? null : column.mapFromDriverValue(row[key])])) as T['$inferSelect']));
}
// One fact loader feeds the guide and the existing package write guard.
export async function projectWorkflowFactsMany(ids: string[], client: typeof db | Tx = db) {
  if (!ids.length) return [];
  const projects = await client.select({ p: proyectos, serviceCode: servicios.codigo,
    editorId: sql<string | null>`case when exists(select 1 from project_assignments a where a.proyecto_id=${proyectos.id} and a.tipo='editor' and a.work_item_id is null) then (select a.usuario_id from project_assignments a where a.proyecto_id=${proyectos.id} and a.tipo='editor' and a.work_item_id is null and a.finalizado_en is null order by a.asignado_en desc,a.id desc limit 1) else ${proyectos.editorId} end`,
    correction: factRows(correcciones, sql`${correcciones.proyectoId}=${proyectos.id}`, sql`${correcciones.createdAt} desc, ${correcciones.id} desc`),
    creative: factRows(direccionesCreativas, sql`${direccionesCreativas.proyectoId}=${proyectos.id}`, sql`${direccionesCreativas.createdAt} desc, ${direccionesCreativas.id} desc`),
    designs: factRows(disenos, sql`${disenos.proyectoId}=${proyectos.id}`, sql`${disenos.solicitadoEn} desc, ${disenos.id} desc`),
    versions: factRows(disenoVersiones, sql`${disenoVersiones.disenoId} in (select id from ${disenos} where ${disenos.proyectoId}=${proyectos.id})`, sql`${disenoVersiones.numero} desc`),
    quality: factRows(fichaCalidadFases, sql`${fichaCalidadFases.fichaId} in (select id from ${fichasTrazabilidad} where ${fichasTrazabilidad.proyectoId}=${proyectos.id})`),
    chapters: factRows(capitulos, sql`${capitulos.proyectoId}=${proyectos.id}`, sql`${capitulos.numero}`),
    works: factRows(workItems, sql`${workItems.proyectoId}=${proyectos.id}`),
    configuration: factRows(fases, sql`${fases.activo} and ${fases.id} in (select fase_id from ${servicioFases} where ${servicioFases.servicioId}=${proyectos.servicioId} and ${servicioFases.activo})`),
    folders: factRows(projectDriveFolders, sql`${projectDriveFolders.status}='READY' and ${projectDriveFolders.workspaceId} in (select id from ${projectDriveWorkspaces} where ${projectDriveWorkspaces.projectId}=${proyectos.id} and ${projectDriveWorkspaces.status}='READY')`),
    documents: factRows(fichaDocumentalDatos, sql`${fichaDocumentalDatos.proyectoId}=${proyectos.id} and ${fichaDocumentalDatos.seccion}='diseno'`),
    steps: factRows(pasos, sql`${pasos.faseId} in (select fase_id from ${servicioFases} where ${servicioFases.servicioId}=${proyectos.servicioId})`),
    proposals: factRows(fichaDisenoPropuestas, sql`${fichaDisenoPropuestas.direccionCreativaId} in (select id from ${direccionesCreativas} where ${direccionesCreativas.proyectoId}=${proyectos.id})`),
    requests: factRows(solicitudesArea, sql`${solicitudesArea.proyectoId}=${proyectos.id}`, sql`${solicitudesArea.requestedAt} desc`),
    assignments: factRows(projectAssignments, sql`${projectAssignments.proyectoId}=${proyectos.id}`, sql`${projectAssignments.asignadoEn} desc, ${projectAssignments.id} desc`),
    participants: sql<{id:string;nombre:string}[]>`(select coalesce(jsonb_agg(jsonb_build_object('id',${users.id},'nombre',${users.nombre})),'[]'::jsonb) from ${users} where ${users.id} in (select usuario_id from ${projectAssignments} where ${projectAssignments.proyectoId}=${proyectos.id}))`,
    contracts: factRows(contratosCorreccion, sql`${contratosCorreccion.correccionId} in (select id from ${correcciones} where ${correcciones.proyectoId}=${proyectos.id})`, sql`${contratosCorreccion.ronda} desc`),
    decisions: factRows(decisiones, sql`${decisiones.proyectoId}=${proyectos.id}`, sql`${decisiones.requestedAt}`),
    deliveries: factRows(editorialDeliveries, sql`${editorialDeliveries.projectId}=${proyectos.id}`, sql`${editorialDeliveries.submittedAt} desc`),
    preparation: factRows(preparacionesProyecto, sql`${preparacionesProyecto.proyectoId}=${proyectos.id}`),
    extraction: factRows(reunionesExtraccion, sql`${reunionesExtraccion.proyectoId}=${proyectos.id}`, sql`${reunionesExtraccion.numero}`),
  }).from(proyectos).innerJoin(servicios, eq(servicios.id, proyectos.servicioId)).where(inArray(proyectos.id, ids));
  return projects.map(f => ({ ...f, versions: f.versions.map(v => ({ v, type: f.designs.find(d=>d.id===v.disenoId)!.tipo })), configuration: f.configuration.map(c=>({id:c.id,code:c.codigo,name:c.nombre})), documents: f.documents[0]?.datos ?? {} }));
}
export async function projectWorkflowFacts(id: string, client: typeof db | Tx = db) {
  const [facts] = await projectWorkflowFactsMany([id], client);
  if (!facts) throw Object.assign(new Error('Proyecto no encontrado'), { statusCode: 404 });
  return facts;
}
export type WorkflowFacts = Awaited<ReturnType<typeof projectWorkflowFacts>>;
export function currentDesignVersion(f: WorkflowFacts, type: string) {
  const design = f.designs.find(d => d.tipo === type);
  return design ? f.versions.find(v => v.v.disenoId === design.id)?.v : undefined;
}
export function creativeReady(f: WorkflowFacts) {
  const c = f.creative.find(c => c.tipo === 'concepto_portada');
  return !!c && c.resultadoFinal === 'aprobado' && !!c.briefEnlace && !!c.fechaBriefAprobadoAutor && !!c.recursoImagenUrl && !!c.recursoConceptoPdfUrl
    && f.proposals.some(p => p.direccionCreativaId === c.id && p.fechaAprobadaAutor && p.fechaAprobadaRrpp);
}
export function editorialPackageRequirements(f: WorkflowFacts): { requirements: GuideRequirement[]; configurationSource: FinalPackageGate['configurationSource'] } {
  const requirements: GuideRequirement[] = [];
  const folders = new Set(f.folders.map(x => x.key));
  const codes = new Set(f.configuration.map(x => x.code));
  const source = codes.size ? 'service_configuration' : folders.has('FINAL_PACKAGE') ? 'persisted_workspace' : 'unconfirmed';
  if (source === 'unconfirmed') requirements.push(requirement('configuration', 'Confirmar configuración editorial aplicable al servicio', false, 'servicio_fases / workspace persistido'));
  const applies = (type: string, folder: string) => codes.size ? codes.has(type) : folders.has(folder);
  if (applies('edicion', 'EDITING')) requirements.push(requirement('editing', 'Edición y feedback de tripa completados', f.p.fechaFeedbackTripa && !f.works.some(w => w.tipo === 'edicion' && ['pendiente','en_progreso','bloqueado'].includes(w.estado)), 'proyectos.fechaFeedbackTripa / work_items'));
  const correction = f.correction.find(c => c.alcance === 'tripa_completa');
  if (applies('correccion', 'CORRECTION')) requirements.push(requirement('correction', 'Tripa corregida con Word e informe técnico', correction?.fechaEntrega && correction.controlCambiosUrl && correction.informeTecnicoUrl, 'correcciones'));
  if (applies('direccion_creativa', 'CREATIVE') || applies('diseno', 'DESIGN')) requirements.push(requirement('creative', 'Concepto creativo aprobado y recursos entregados', creativeReady(f), 'direcciones_creativas / ficha_diseno_propuestas'));
  const diagram = currentDesignVersion(f, 'diagramacion');
  const latest = diagram ? [diagram] : [];
  if (applies('diseno', 'DESIGN')) {
    requirements.push(requirement('design', 'Diagramación entregada', diagram && !diagram.feedbackEn, 'diseno_versiones'));
    const cover = currentDesignVersion(f, 'cubierta_extendida');
    requirements.push(requirement('cover', 'Cubierta vigente aprobada por Creativa, Validador y Autor', cover?.aprobadaInternaEn && cover.aprobadaAutorEn && !cover.feedbackEn && f.creative.some(c => c.id === cover.revisionCreativaId && c.resultadoFinal === 'aprobado'), 'diseno_versiones / direcciones_creativas'));
  }
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
export async function finalPackageGate(id: string, client: typeof db | Tx = db, facts?: WorkflowFacts, knownFinancial?: Awaited<ReturnType<typeof getProjectFinancialStatus>>): Promise<FinalPackageGate> {
  const f = facts ?? await projectWorkflowFacts(id, client);
  const { requirements, configurationSource } = editorialPackageRequirements(f);
  const financial = knownFinancial ?? await getProjectFinancialStatus(id, client);
  const canPrepare = requirements.every(r => r.satisfied);
  const prepared = f.documents.paqueteFinalCargado === true;
  return { requirements, configurationSource, canPrepare, prepared, financialSatisfied: financial?.gateSatisfied === true,
    canRelease: canPrepare && prepared && financial?.gateSatisfied === true,
    financialMessage: financial?.gateSatisfied ? 'Liberación administrativa habilitada' : 'No hay solvencia administrativa confirmada. Solicita revisión a Comercial, responsable actual de la aprobación; Cobranzas verifica los pagos.' };
}
