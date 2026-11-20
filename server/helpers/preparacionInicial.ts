import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { preparacionesProyecto, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, workItems } from '../db/schema/index.js';
import { verificarAccesoFichaViva, ErrorFichaViva } from './fichaViva.js';
import { registrarEvento } from './auditLog.js';
import { crearWorkItemSiNoExiste, transicionarWorkItemPorId } from './workItems.js';
import type { ActorFicha } from './intakeRrpp.js';
import type { PreparacionProyecto } from '../../shared/operacionEspecialista.js';
import type { ProjectWorkspaceSummary } from '../../shared/projectWorkspace.js';
import { emptyWorkspace,workspaceSummaries } from '../modules/project-workspaces/queries.js';
import { withCorporateDrive, type CorporateDriveOperation } from '../modules/integrations/google-drive/corporate.js';
import { projectWorkflowFacts } from './finalPackage.js';
import { tieneProcesosPosterioresALaPreparacion } from './preparacionWorkflow.js';

const instante = z.string().datetime({ offset: true }).nullable().optional();
const link = z.string().url().max(2000).refine(s => /^https:\/\//.test(s), 'Utiliza un enlace HTTPS').nullable().optional();
export const preparacionInicialSchema = z.object({
  recibidoEn: instante, expedienteRevisadoEn: instante, primerContactoEn: instante,
  reunionOperativaFecha: instante, reunionOperativaRealizada: z.boolean().optional(),
  grabacionUrl: link, transcripcionUrl: link, minutaUrl: link, cronogramaUrl: link,
  cronogramaEntrevistasEfUrl: link, estructuraPreliminaresUrl: link, solicitudInformacionAutorUrl: link,
  // extraccionEnlaces NO va aquí: lo sube el Editor que condujo la
  // entrevista, vía PATCH /proyectos/:id/extraccion-archivos (ver
  // registrarArchivosExtraccion más abajo), no el Especialista.
  observaciones: z.string().trim().max(2000).nullable().optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Indica un cambio');

// Manual §1.2: 24 horas; no inventa un calendario laboral no documentado.
export const calcularPrimerContactoDueAt = (asignadoEn: Date | null) => asignadoEn ? new Date(asignadoEn.getTime() + 24 * 3600000).toISOString() : null;
export function proyectarPreparacion(row: typeof preparacionesProyecto.$inferSelect | undefined, asignadoEn: Date | null, editable: boolean,workspace:ProjectWorkspaceSummary=emptyWorkspace()): PreparacionProyecto {
  const f = row;
  const documental=workspace.status==='READY'&&!workspace.contextChanged;
  const completo = !!(f?.recibidoEn && f.expedienteRevisadoEn && f.primerContactoEn && f.reunionOperativaRealizada && documental && f.minutaUrl && f.cronogramaUrl && f.grabacionUrl && f.transcripcionUrl);
  const iniciado = !!(f?.recibidoEn || f?.expedienteRevisadoEn || f?.primerContactoEn || f?.reunionOperativaFecha || f?.reunionOperativaRealizada || f?.driveCarpetaUrl || f?.minutaUrl || f?.cronogramaUrl || f?.grabacionUrl || f?.transcripcionUrl || f?.cronogramaEntrevistasEfUrl || f?.estructuraPreliminaresUrl || f?.solicitudInformacionAutorUrl || f?.extraccionEnlaces?.length || f?.observaciones?.trim());
  return {
    recibidoEn: f?.recibidoEn?.toISOString() ?? null, expedienteRevisadoEn: f?.expedienteRevisadoEn?.toISOString() ?? null,
    primerContactoEn: f?.primerContactoEn?.toISOString() ?? null, primerContactoDueAt: calcularPrimerContactoDueAt(asignadoEn),
    reunionOperativaFecha: f?.reunionOperativaFecha?.toISOString() ?? null, reunionOperativaRealizada: f?.reunionOperativaRealizada ?? false,
    grabacionUrl: f?.grabacionUrl ?? null, transcripcionUrl: f?.transcripcionUrl ?? null, minutaUrl: f?.minutaUrl ?? null, cronogramaUrl: f?.cronogramaUrl ?? null,
    cronogramaEntrevistasEfUrl: f?.cronogramaEntrevistasEfUrl ?? null,
    estructuraPreliminaresUrl: f?.estructuraPreliminaresUrl ?? null, solicitudInformacionAutorUrl: f?.solicitudInformacionAutorUrl ?? null,
    extraccionEnlaces: f?.extraccionEnlaces ?? null,
    driveCarpetaUrl: documental?workspace.rootFolderUrl:f?.driveCarpetaUrl ?? null, driveEstado: documental?'configurado':workspace.status==='ERROR'||workspace.contextChanged?'error':['PENDING','PROVISIONING'].includes(workspace.status)?'pendiente':'no_configurado',
    workspace,observaciones: f?.observaciones ?? null, estado: completo ? 'Completo' : iniciado||workspace.id ? 'En curso' : 'Pendiente', editable,
  };
}
export async function guardarPreparacionInicial(id: string, input: z.infer<typeof preparacionInicialSchema>, actor: ActorFicha) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'La preparación corresponde al Especialista asignado');
  return db.transaction(async tx => {
    await tx.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.id, id)).for('update');
    const p = await verificarAccesoFichaViva(id, actor, tx);
    if (['culminado', 'retirado'].includes(p.estado)) throw new ErrorFichaViva(409, 'El proyecto está cerrado');
    const [before] = await tx.select().from(preparacionesProyecto).where(eq(preparacionesProyecto.proyectoId, id));
    const datos = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, k.endsWith('En') || k === 'reunionOperativaFecha' ? v ? new Date(v as string) : null : v]));
    const merged = { ...before, ...datos } as typeof preparacionesProyecto.$inferSelect;
    const ahora = new Date();
    for (const k of ['recibidoEn', 'expedienteRevisadoEn', 'primerContactoEn'] as const) {
      if (merged[k] && merged[k]! > ahora) throw new ErrorFichaViva(400, 'Una acción realizada no puede tener fecha futura');
    }
    if (merged.reunionOperativaRealizada && (!merged.reunionOperativaFecha || merged.reunionOperativaFecha > ahora)) throw new ErrorFichaViva(400, 'La reunión realizada requiere una fecha hasta hoy');
    const cambios = Object.keys(datos).filter(k => JSON.stringify(before?.[k as keyof typeof before] ?? null) !== JSON.stringify(datos[k]));
    if (!cambios.length && before) return before;
    const facts = await projectWorkflowFacts(id, tx);
    if (cambios.some(k => k !== 'observaciones') && tieneProcesosPosterioresALaPreparacion(facts)) throw new ErrorFichaViva(409, 'Este cambio puede afectar procesos posteriores. La preparación queda de solo lectura hasta contar con una invalidación segura.');
    const [row] = await tx.insert(preparacionesProyecto).values({ proyectoId: id, ...datos }).onConflictDoUpdate({ target: preparacionesProyecto.proyectoId, set: { ...datos, updatedAt: ahora } }).returning();
    const [a] = await tx.select().from(projectAssignments).where(and(eq(projectAssignments.proyectoId, id), eq(projectAssignments.tipo, 'especialista'), isNull(projectAssignments.workItemId), isNull(projectAssignments.finalizadoEn))).orderBy(desc(projectAssignments.asignadoEn)).limit(1);
    const wi = await crearWorkItemSiNoExiste(tx, { proyectoId: id, tipo: 'preparacion_inicial' });
    const workspace=(await workspaceSummaries([id])).get(id)??emptyWorkspace();
    const estado = proyectarPreparacion(row, a?.asignadoEn ?? null, true,workspace).estado;
    if(estado==='Pendiente') {
      // Un guardado sin hechos no simula el inicio del trabajo.
      const { workItems } = await import('../db/schema/index.js');
      await tx.update(workItems).set({estado:'pendiente',fechaFinReal:null}).where(eq(workItems.id,wi));
    } else await transicionarWorkItemPorId(tx, wi, estado === 'Completo' ? 'completado' : 'en_progreso');
    await registrarEvento(tx, { actorId: actor.id, accion: 'PREPARACION_INICIAL_ACTUALIZADA', entityType: 'proyecto', entityId: id, proyectoId: id, detalles: { campos: cambios } });
    return row;
  });
}

// La grabación y las notas de Gemini de cada sesión de extracción ahora
// viven por sesión (reunionesExtraccion.videoUrl/notasGeminiUrl) — ver
// registrarVideoSesion/subirNotasSesion en server/helpers/extraccion.ts.
// extraccionEnlaces (arriba) queda como dato histórico, sin un escritor activo.

// Subida real del archivo (no pegar un enlace) a la carpeta RAÍZ del
// proyecto (no la raíz de Drive) — mismo patrón base64→Buffer→uploadFile
// ya probado en validaciones.ts/editorDrive.ts, reutilizado tal cual.
const DOC_FIELDS = {
  minuta: 'minutaUrl', cronograma: 'cronogramaUrl', cronogramaEntrevistasEf: 'cronogramaEntrevistasEfUrl',
  estructuraPreliminares: 'estructuraPreliminaresUrl', solicitudInformacionAutor: 'solicitudInformacionAutorUrl',
} as const;
export type DocumentoPreparacionCampo = keyof typeof DOC_FIELDS;
const MIME_TYPES: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
export const subirDocumentoPreparacionSchema = z.object({
  campo: z.enum(Object.keys(DOC_FIELDS) as [DocumentoPreparacionCampo, ...DocumentoPreparacionCampo[]]),
  name: z.string().min(1).max(250),
  contentBase64: z.string().max(28_000_000),
}).strict();
export async function subirDocumentoPreparacion(id: string, input: z.infer<typeof subirDocumentoPreparacionSchema>, actor: ActorFicha, operate: CorporateDriveOperation = withCorporateDrive) {
  if (actor.rol !== 'especialista') throw new ErrorFichaViva(403, 'La preparación corresponde al Especialista asignado');
  const dbField = DOC_FIELDS[input.campo];
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64)) throw new ErrorFichaViva(400, 'Archivo inválido');
  const content = Buffer.from(input.contentBase64, 'base64');
  if (!content.length || content.length > 20 * 1024 * 1024 || content.toString('base64') !== input.contentBase64) throw new ErrorFichaViva(400, 'El archivo debe pesar entre 1 byte y 20 MB');
  const ext = input.name.split('.').pop()?.toLowerCase();
  if (!ext || !MIME_TYPES[ext] || /[\x00-\x1f]/.test(input.name)) throw new ErrorFichaViva(400, 'Selecciona un PDF, Word o Excel');
  const magic = ext === 'pdf' ? content.subarray(0, 5).toString() === '%PDF-' : ext === 'docx' || ext === 'xlsx' ? content.subarray(0, 2).toString() === 'PK' : content.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
  if (!magic) throw new ErrorFichaViva(400, 'El contenido no coincide con el tipo de archivo');
  const workspace = (await workspaceSummaries([id])).get(id);
  if (!workspace || workspace.status !== 'READY' || workspace.contextChanged) throw new ErrorFichaViva(409, 'Crea primero las carpetas del proyecto en Drive');
  const [ws] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, id));
  if (!ws) throw new ErrorFichaViva(409, 'El espacio documental del proyecto no está disponible. Intenta de nuevo.');
  const [root] = await db.select().from(projectDriveFolders).where(and(eq(projectDriveFolders.workspaceId, ws.id), eq(projectDriveFolders.key, 'ROOT'), eq(projectDriveFolders.status, 'READY')));
  if (!root) throw new ErrorFichaViva(409, 'La carpeta raíz del proyecto no está disponible');
  const url = await operate(async ({ integration, storage }) => {
    if (ws.integrationId !== integration.id || ws.storageContextId !== integration.storageContextId) throw new ErrorFichaViva(409, 'La conexión de Drive cambió');
    if (!storage.uploadFile) throw new ErrorFichaViva(503, 'Drive no permite subir archivos');
    const file = await storage.uploadFile({ name: input.name, mimeType: MIME_TYPES[ext]!, parentFolderId: root.driveFolderId, content });
    return `https://drive.google.com/file/d/${file.providerFileId}/view`;
  });
  const payload = { [dbField]: url } as Pick<z.infer<typeof preparacionInicialSchema>, typeof dbField>;
  const row = await guardarPreparacionInicial(id, payload, actor);
  return { url, preparacion: row };
}
