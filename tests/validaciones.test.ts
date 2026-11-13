import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ context: null as any }));
vi.mock('../server/modules/integrations/google-drive/corporate.js', () => ({ withCorporateDrive: async (fn: any) => fn(fake.context) }));
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import { auditLogs, direccionesCreativas, disenos, disenoVersiones, externalIntegrations, fichaCalidadFases, fichasTrazabilidad, notificaciones, projectAssignments, projectDriveFolders, projectDriveWorkspaces, proyectos, users, validationDeliveryOutbox, workItems } from '../server/db/schema/index.js';
import { deliverValidationMail, detectValidationDeliveries, relevantDesignFile } from '../server/helpers/validationDrive.js';
import { validationFileName } from '../server/helpers/validaciones.js';
import { completarPreparacionDePrueba, crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import type { StorageItem } from '../server/modules/integrations/google-drive/provider.js';

describe('Validadores: asignaciones individuales y ciclo real de Drive', () => {
 let app: ReturnType<typeof buildApp>, specialist: Awaited<ReturnType<typeof crearUsuario>>, chief: typeof specialist, ana: typeof specialist, other: typeof specialist;
 let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>, designId: string, phaseId: string, folderId: string, commentsFolder: string;
 let cookies: Record<string, string>, files: StorageItem[], uploaded: { name: string; parentFolderId: string; content: Buffer }[];
 const pdf = Buffer.from('%PDF-1.7\nQA comments\n%%EOF').toString('base64');
 async function call(role: string, method: 'GET' | 'POST' | 'PATCH', path: string, payload?: any) { return app.inject({ method, url: '/api' + path, headers: { cookie: cookies[role] ?? '' }, payload }); }
 async function detail() { const r = await call('ana', 'GET', `/validaciones/${phaseId}`); expect(r.statusCode).toBe(200); return r.json(); }
 async function assign() { expect((await call('specialist', 'POST', `/validaciones/${phaseId}/solicitar`)).statusCode).toBe(200); expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: ana.id })).statusCode).toBe(200); }
 async function upload(name = 'comentarios libro FINAL 3.pdf', key = randomUUID()) { const r = await call('ana', 'POST', `/validaciones/${phaseId}/archivo`, { name, key, contentBase64: pdf }); expect(r.statusCode).toBe(200); return { ...r.json(), key }; }
 async function decide(result: 'comentarios' | 'todos_aplicados', key = randomUUID(), assignmentId?: string) { const id = assignmentId ?? (await detail()).assignmentId; return call('ana', 'POST', `/validaciones/${phaseId}/decision`, { result, key, assignmentId: id }); }
 function delivery(version: number, extras: Partial<StorageItem> = {}) { const f: StorageItem = { providerFileId: `file-${randomUUID()}`, name: `V${version}.pdf`, mimeType: 'application/pdf', webViewLink: null, parents: [folderId], appProperties: {}, size: 100, contributorEmails: ['design@example.test'], modifiedAt: new Date(Date.now() + 1000).toISOString(), ...extras }; files.push(f); return f; }
 async function detect(version: number) { delivery(version); expect(await detectValidationDeliveries()).toEqual({ received: 1 }); const [v] = await db.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, designId), eq(disenoVersiones.numero, version))); phaseId = v!.calidadFaseId!; return v!; }
 beforeEach(async () => {
  await limpiarBaseDeDatos(); app = buildApp(); await app.ready();
  specialist = await crearUsuario('especialista'); chief = await crearUsuario('jefe_area'); ana = await crearUsuario('validador'); other = await crearUsuario('validador');
  p = await crearProyectoDePrueba({ especialistaId: specialist.id }); await completarPreparacionDePrueba(p.id);
  const [cw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
  const [creative] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
  const [dw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', estado: 'en_progreso' }).returning();
  const [d] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: dw!.id, tipo: 'diagramacion', direccionCreativaId: creative!.id, solicitudKey: randomUUID(), fuenteUrl: 'https://drive.google.com/file/d/source-tripa/view', preparacionConfirmada: true }).returning(); designId = d!.id;
  const [w] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, p.id));
  const [integration] = await db.select().from(externalIntegrations).where(eq(externalIntegrations.id, w!.integrationId));
  folderId = 'versions-' + p.id; commentsFolder = 'comments-' + p.id;
  for (const [key, folder] of [['DESIGN_REVIEW_VERSIONS', folderId], ['QUALITY_COMMENTS', commentsFolder]]) await db.insert(projectDriveFolders).values({ workspaceId: w!.id, key: key!, driveFolderId: folder!, displayName: key!, templatePath: key!, status: 'READY' });
  files = [{ providerFileId: 'source-tripa', name: 'Tripa.pdf', mimeType: 'application/pdf', size: 100, parents: [folderId], appProperties: {}, webViewLink: null }]; uploaded = [];
  fake.context = { integration: { ...integration, scope: ['https://www.googleapis.com/auth/drive'] }, storage: { listFiles: async () => ({ items: files, nextPageToken: null }), getMetadata: async (id: string) => files.find(f => f.providerFileId === id), pinAuthorRevision: async () => ({ revisionId: 'pinned-revision', mimeType: 'application/pdf' }), readAuthorRevision: async () => Buffer.from('%PDF-1.7 exact'), uploadFile: async (input: any) => { uploaded.push(input); return { providerFileId: randomUUID(), name: input.name }; }, deleteFileOrFolder: vi.fn() } };
  cookies = {};
  for (const [role, u] of Object.entries({ specialist, chief, ana, other })) { const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' } }); expect(r.statusCode).toBe(200); cookies[role] = r.cookies.map(c => `${c.name}=${c.value}`).join('; '); }
  expect((await call('specialist', 'POST', `/validaciones/diseno/${designId}/proveedor`, { name: 'Estudio X', email: 'design@example.test' })).statusCode).toBe(200);
  await detect(0);
 }, 60000);
 afterEach(async () => { await app.close(); });
 it('contrato público: un único rol validador con almacenamiento histórico encapsulado', async () => {
  const me = await call('ana', 'GET', '/auth/me'); expect(me.statusCode).toBe(200); expect(me.json().user.rol).toBe('validador');
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: ana.email, password: 'password123' } }); expect(login.json().user.rol).toBe('validador');
  const stored = await pool.query('select rol::text from usuarios where id=$1', [ana.id]); expect(stored.rows[0].rol).toBe('soporte_editorial');
  expect((await db.select().from(users).where(eq(users.rol, 'validador'))).map(u => u.id).sort()).toEqual([ana.id, other.id].sort());
  const administrator = await crearUsuario('admin'); const auth = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: administrator.email, password: 'password123' } }); cookies.admin = auth.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  const policy = await call('admin', 'GET', '/admin/policy'); expect(policy.json().roles).toContain('validador'); expect(policy.body).not.toContain('soporte_editorial');
  const accounts = await call('admin', 'GET', '/admin/usuarios?role=validador'); expect(accounts.statusCode).toBe(200); expect(accounts.json().items).toHaveLength(2); expect(accounts.json().items.every((u: any) => u.role === 'validador')).toBe(true);
  expect((await call('admin', 'GET', '/admin/usuarios?role=soporte_editorial')).statusCode).toBe(400);
  const sessions = await call('admin', 'GET', '/admin/sesiones'); expect(sessions.statusCode).toBe(200); expect(sessions.body).not.toContain('soporte_editorial');
  await db.insert(notificaciones).values({ proyectoId: p.id, rolDestino: 'especialista', usuarioDestinoId: specialist.id, mensaje: 'Soporte Editorial reportó un bloqueo histórico' });
  const historicalNotices = await call('specialist', 'GET', '/notificaciones'); expect(historicalNotices.body).toContain('El Validador reportó'); expect(historicalNotices.body).not.toContain('Soporte Editorial reportó');
  await db.insert(auditLogs).values({ actorId: ana.id, accion: 'VALIDADOR_SOLICITADO', entityType: 'work_item', entityId: phaseId, proyectoId: p.id, detalles: { role: 'soporte_editorial' } });
  const history = await call('admin', 'GET', '/admin/actividad?role=validador'); expect(history.statusCode).toBe(200); expect(history.json().items.length).toBeGreaterThan(0); expect(history.body).not.toContain('soporte_editorial');
 });
 it('una sesión recibe Proyecto A Calidad, Proyecto B cubierta y Proyecto C Revisión Final; cubierta conserva permisos y ciclos', async () => {
  await assign(); const qualityId = phaseId;
  async function projectDesign(type: string, title: string) {
   const project = await crearProyectoDePrueba({ especialistaId: specialist.id });
   await db.update(proyectos).set({ titulo: title }).where(eq(proyectos.id, project.id)); await completarPreparacionDePrueba(project.id);
   await db.insert(fichasTrazabilidad).values({ proyectoId: project.id }).onConflictDoNothing();
   const [creativeWork] = await db.insert(workItems).values({ proyectoId: project.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
   const [creative] = await db.insert(direccionesCreativas).values({ proyectoId: project.id, workItemId: creativeWork!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
   const [work] = await db.insert(workItems).values({ proyectoId: project.id, tipo: 'diseno' }).returning();
   const [design] = await db.insert(disenos).values({ proyectoId: project.id, workItemId: work!.id, tipo: type, direccionCreativaId: creative!.id, fuenteUrl: 'https://drive.google.com/file/d/source-tripa/view', solicitudKey: randomUUID(), externalProviderName: 'Estudio X', externalProviderEmail: 'design@example.test' }).returning();
   const [workspace] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, project.id));
   const folder = 'versions-' + project.id;
   for (const [key, id] of [['DESIGN_REVIEW_VERSIONS', folder], ['QUALITY_COMMENTS', 'comments-' + project.id]]) await db.insert(projectDriveFolders).values({ workspaceId: workspace!.id, key: key!, driveFolderId: id!, displayName: key!, templatePath: key!, status: 'READY' });
   return { project, design: design!, folder };
  }
  const b = await projectDesign('cubierta_extendida', 'Proyecto B'); delivery(0, { name: 'Cubierta_V0.pdf', parents: [b.folder] }); expect(await detectValidationDeliveries()).toEqual({ received: 1 });
  const [cover] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, b.project.id), eq(workItems.tipo, 'validacion_cubierta'))); phaseId = cover!.id;
  expect((await call('other', 'GET', `/validaciones/${phaseId}`)).statusCode).toBe(404);
  expect((await call('ana', 'POST', `/validaciones/${phaseId}/solicitar`)).statusCode).toBe(403);
  // An explicit request for an existing cover is idempotent and never resets it.
  expect((await call('specialist', 'POST', `/validaciones/diseno/${b.design.id}/solicitar-cubierta`)).statusCode).toBe(200);
  await assign(); const coverDetail = await detail(); expect(coverDetail.context).toBe('SOPORTE_EDITORIAL'); expect(coverDetail.workType).toBe('REVISION_CUBIERTA'); expect(coverDetail.canApprove).toBe(false);
  expect((await decide('todos_aplicados')).statusCode).toBe(409);
  expect((await call('other', 'GET', `/validaciones/${phaseId}/archivo`)).statusCode).toBe(404);
  expect((await call('ana', 'GET', `/validaciones/${phaseId}/archivo`)).statusCode).toBe(200);
  const c = await projectDesign('diagramacion', 'Proyecto C');
  const [f] = await db.insert(fichasTrazabilidad).values({ proyectoId: c.project.id }).onConflictDoNothing().returning();
  const ficha = f ?? (await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, c.project.id)))[0]!;
  const [finalWork] = await db.insert(workItems).values({ proyectoId: c.project.id, tipo: 'calidad' }).returning();
  const [finalVersion] = await db.insert(disenoVersiones).values({ disenoId: c.design.id, numero: 2, entregaKey: randomUUID(), enlace: 'https://drive.google.com/file/d/final-v2/view', driveFileId: 'final-v2', driveRevisionId: 'pinned', aprobadaAutorEn: new Date() }).returning();
  const [final] = await db.insert(fichaCalidadFases).values({ fichaId: ficha.id, numeroFase: 3, ronda: 1, workItemId: finalWork!.id, disenoVersionId: finalVersion!.id, pdfVersion: 'V2', solicitadoEn: new Date() }).returning();
  await db.update(disenoVersiones).set({ calidadFaseId: final!.id, calidadWorkItemId: finalWork!.id }).where(eq(disenoVersiones.id, finalVersion!.id));
  phaseId = final!.id; await assign();
  const inbox = await call('ana', 'GET', '/validaciones/'); expect(inbox.statusCode).toBe(200); expect(inbox.json().items).toHaveLength(3);
  expect(inbox.json().items.map((i: any) => [i.context, i.workType])).toEqual(expect.arrayContaining([['CALIDAD','VALIDACION_FASE_1'], ['SOPORTE_EDITORIAL','REVISION_CUBIERTA'], ['CALIDAD','REVISION_FINAL']]));
  expect(inbox.body).not.toContain('soporte_editorial');
  expect((await call('other', 'GET', '/validaciones/')).json().items).toHaveLength(0);
  const center = await call('specialist', 'GET', `/proyectos/${b.project.id}/command-center`); expect(center.statusCode, center.body).toBe(200);
  expect(center.json().procesos.find((i: any) => i.tipo === 'validacion_cubierta')).toMatchObject({ ownerRole: 'validador', assignee: ana.nombre });
  const pending = (await call('chief', 'GET', '/validaciones/candidatos')).json().items.find((u: any) => u.id === ana.id); expect(pending.pending).toBe(3);
  phaseId = cover!.id; const file = await upload(); expect(file.name).toMatch(/^V0_CUBIERTA_R1_/);
  const initialAssignment = (await detail()).assignmentId;
  expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: other.id })).statusCode).toBe(200);
  expect((await decide('comentarios', randomUUID(), initialAssignment)).statusCode).toBe(404);
  expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: ana.id })).statusCode).toBe(200);
  expect((await call('specialist', 'POST', `/validaciones/diseno/${b.design.id}/solicitar-cubierta`)).statusCode).toBe(200);
  await upload(); expect((await decide('comentarios')).statusCode).toBe(200);
  const [coverMail] = await db.select().from(validationDeliveryOutbox).where(eq(validationDeliveryOutbox.versionId, (await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, b.design.id)))[0]!.id)); expect(coverMail!.message).toContain('Cubierta_V1.pdf');
  delivery(1, { name: 'Cubierta_V1.pdf', parents: [b.folder] }); expect(await detectValidationDeliveries()).toEqual({ received: 1 });
  const next = (await call('ana', 'GET', '/validaciones/')).json().items.find((i: any) => i.context === 'SOPORTE_EDITORIAL'); expect(next.version).toBe('V1'); phaseId = next.id;
  expect((await detail()).materials.some((m: any) => m.role === 'previous_comments')).toBe(true);
  expect((await call('ana', 'GET', `/validaciones/${phaseId}/archivo?material=previous_comments`)).statusCode).toBe(200);
  const notices = await call('ana', 'GET', '/notificaciones'); expect(notices.body).toContain('Soporte Editorial'); expect(notices.body).not.toContain('soporte_editorial');
  expect((await decide('todos_aplicados')).statusCode).toBe(200);
  const [v1] = await db.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, b.design.id), eq(disenoVersiones.numero, 1))); expect(v1!.aprobadaInternaEn).toBeNull(); expect(v1!.revisionCreativaId).not.toBeNull();
  expect((await call('ana', 'GET', '/validaciones/')).json().items.map((i: any) => i.id).sort()).toEqual([qualityId, final!.id].sort());
  expect(await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.fichaId, ficha.id))).toHaveLength(1);
  expect(await db.select().from(fichaCalidadFases)).toHaveLength(2); // no fake Quality rows for cover
 }, 60000);
 it('QA completo: V0 → V1 con errores → V2 aprobada; repite en Revisión Final sin avanzar proceso global', async () => {
  await assign();
  expect((await detail()).canApprove).toBe(false);
  expect((await decide('todos_aplicados')).statusCode).toBe(409);
  expect((await decide('comentarios')).statusCode).toBe(409);
  const first = await upload(); expect(first.name).toMatch(/^V0_F1_R1_correcciones_a_aplicar_[a-f0-9-]+\.pdf$/); expect(uploaded[0]!.parentFolderId).toBe(commentsFolder);
  const key = randomUUID(), a = (await detail()).assignmentId;
  const responses = await Promise.all([decide('comentarios', key, a), decide('comentarios', key, a)]); expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
  expect((await call('ana', 'GET', '/validaciones/')).json().items).toHaveLength(0);
  const center = await call('specialist', 'GET', `/proyectos/${p.id}/command-center`); expect(center.statusCode).toBe(200);
  const quality = center.json().procesos.find((process: any) => process.tipo === 'calidad'); expect(quality.assignee).toBe(ana.nombre); expect(quality.estado).toBe('En curso'); expect(quality.detalle).toContain('Esperando nueva versión de Diseño');
  const sent: string[] = []; await deliverValidationMail(async m => { sent.push(m.recipient); }); await deliverValidationMail(async m => { sent.push(m.recipient); }); expect(sent).toEqual(['design@example.test']);
  await detect(1); expect((await detail()).canApprove).toBe(true); expect((await detail()).materials.some((m: any) => m.role === 'previous_comments')).toBe(true);
  expect((await decide('comentarios')).statusCode).toBe(409);
  const second = await upload(); expect(second.fileId).not.toBe(first.fileId); expect(second.name).toMatch(/^V1_F2_R1_/);
  expect((await decide('comentarios')).statusCode).toBe(200);
  await detect(2); expect((await detail()).canApprove).toBe(true); expect((await detail()).upload).toBeNull();
  const completed = phaseId; expect((await decide('todos_aplicados')).statusCode).toBe(200);
  const [project] = await db.select().from(proyectos).where(eq(proyectos.id, p.id)); expect(project!.estado).toBe(p.estado);
  const timeline = await call('specialist', 'GET', `/validaciones/timeline/${p.id}`); expect(timeline.json().items.filter((e: any) => e.action === 'VALIDACION_DISENO_RECIBIDO')).toHaveLength(3); expect(timeline.json().items.filter((e: any) => e.action === 'VALIDACION_TODOS_APLICADOS')).toHaveLength(1);
  for (const action of ['enviar_autor', 'aprobar_autor', 'revision_final']) expect((await call('specialist', 'PATCH', `/calidad/${completed}/coordinacion`, { accion: action })).statusCode).toBe(200);
  const [version] = await db.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, designId), eq(disenoVersiones.numero, 2))); phaseId = version!.calidadFaseId!;
  expect(phaseId).not.toBe(completed); await assign(); expect((await detail()).phaseNumber).toBe(3); expect((await detail()).canApprove).toBe(false);
  await upload(); expect((await decide('comentarios')).statusCode).toBe(200);
  await detect(3); expect((await detail()).phaseNumber).toBe(4); expect((await detail()).canApprove).toBe(true);
  await upload(); expect((await decide('comentarios')).statusCode).toBe(200);
  await detect(4); expect((await decide('todos_aplicados')).statusCode).toBe(200);
  expect((await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]!.estado).toBe(p.estado);
  const phases = await db.select().from(fichaCalidadFases); expect(phases).toHaveLength(6); expect(phases.filter(q => q.aprobado === true)).toHaveLength(2);
 });
 it('RBAC/IDOR: solo asignado, Jefatura asigna, no Ficha/usuarios/proyectos/rutas legacy ni mutaciones globales', async () => {
  expect((await call('specialist', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: ana.id })).statusCode).toBe(403);
  expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: ana.id })).statusCode).toBe(409);
  expect((await call('ana', 'GET', `/validaciones/${phaseId}`)).statusCode).toBe(404);
  await assign(); expect((await call('other', 'GET', '/validaciones/')).json().items).toHaveLength(0);
  for (const suffix of ['', '/archivo']) expect((await call('other', 'GET', `/validaciones/${phaseId}${suffix}`)).statusCode).toBe(404);
  for (const path of [`/proyectos/${p.id}`, `/diseno/proyecto/${p.id}`, `/calidad/proyecto/${p.id}`, '/calidad/inicio', '/calidad/mi-trabajo', '/usuarios', `/fichas-trazabilidad/proyecto/${p.id}`]) expect((await call('ana', 'GET', path)).statusCode).toBe(403);
  expect((await call('ana', 'POST', `/validaciones/${phaseId}/solicitar`)).statusCode).toBe(403);
  expect((await call('ana', 'PATCH', `/calidad/${phaseId}/coordinacion`, { accion: 'aprobar_autor' })).statusCode).toBe(403);
  const dto = JSON.stringify(await detail()); for (const field of ['servicioCodigo', 'especialistaId', 'workItemId', 'contrato', 'precio', 'audit', 'historial']) expect(dto).not.toContain(field);
  expect((await call('ana', 'GET', `/validaciones/${phaseId}/archivo`)).body).toContain('%PDF');
  expect((await call('ana', 'GET', `/validaciones/${phaseId}/archivo?material=source`)).statusCode).toBe(200);
  expect((await call('ana', 'GET', `/validaciones/${phaseId}/archivo?fileId=foreign`)).statusCode).toBe(400);
 });
 it('reasignación invalida la sesión abierta y el upload anterior; cierre concurrente tiene un único resultado', async () => {
  await assign(); const old = await detail(); await upload();
  expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: other.id })).statusCode).toBe(200);
  expect((await decide('comentarios', randomUUID(), old.assignmentId)).statusCode).toBe(404);
  expect((await call('other', 'GET', `/validaciones/${phaseId}`)).json().upload).toBeNull();
  expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: ana.id })).statusCode).toBe(200);
  expect((await decide('comentarios', randomUUID(), old.assignmentId)).statusCode).toBe(409);
  await upload(); const a = (await detail()).assignmentId;
  expect((await Promise.all([decide('comentarios', randomUUID(), a), decide('comentarios', randomUUID(), a)])).map(r => r.statusCode).sort()).toEqual([200, 409]);
 });
 it('carga valida contenido/tamaño, renombra y conserva extensión, retries no duplican archivos ni sobrescriben', async () => {
  await assign();
  for (const input of [{ name: 'bad.exe', contentBase64: pdf }, { name: 'bad.pdf', contentBase64: Buffer.from('not pdf').toString('base64') }, { name: 'bad.pdf', contentBase64: '' }]) expect((await call('ana', 'POST', `/validaciones/${phaseId}/archivo`, { ...input, key: randomUUID() })).statusCode).toBe(400);
  const key = randomUUID(); const first = await upload('incorrecto FINAL.PDF', key); const retry = await upload('incorrecto FINAL.PDF', key); expect(retry.fileId).toBe(first.fileId); expect(uploaded).toHaveLength(1);
  const next = await upload('../../mal nombrado.pdf'); expect(next.fileId).not.toBe(first.fileId); expect(next.name).not.toContain('..'); expect(uploaded).toHaveLength(2);
  expect(validationFileName('V1/../../', 2, 4, 'a.DOCX', 'unique')).toBe('V1_F2_R4_correcciones_a_aplicar_unique.docx');
 });
 it('Drive ignora metadata, carpetas/archivo ajeno, versión incorrecta, proveedor equivocado y entregas ambiguas', async () => {
  await assign(); await upload(); expect((await decide('comentarios')).statusCode).toBe(200);
  const old = files.find(f => f.name === 'V0.pdf')!; old.name = 'V1.pdf'; old.modifiedAt = new Date(Date.now() + 1000).toISOString();
  expect(await detectValidationDeliveries()).toEqual({ received: 0 });
  const unrelated = [delivery(1, { name: 'temporal.pdf' }), delivery(1, { parents: ['foreign'] }), delivery(2), delivery(1, { contributorEmails: ['intruder@example.test'] }), delivery(1, { mimeType: 'application/vnd.google-apps.shortcut' }), delivery(1, { modifiedAt: '2020-01-01T00:00:00Z' })];
  expect(await detectValidationDeliveries()).toEqual({ received: 0 }); expect(await db.select().from(disenoVersiones)).toHaveLength(1);
  for (const f of unrelated) expect(relevantDesignFile(f, folderId, 1, 'design@example.test', new Date())).toBe(false);
  delivery(1); delivery(1); expect(await detectValidationDeliveries()).toEqual({ received: 0 });
  files.splice(-1, 1); expect(await detectValidationDeliveries()).toEqual({ received: 1 }); expect(await detectValidationDeliveries()).toEqual({ received: 0 });
  expect(await db.select().from(fichaCalidadFases)).toHaveLength(2);
 });
 it('notificaciones son dirigidas y solo accionables; SMTP fallido conserva outbox para reintento', async () => {
  await assign(); await upload(); expect((await decide('comentarios')).statusCode).toBe(200);
  await deliverValidationMail(async () => { throw new Error('offline'); });
  const [mail] = await db.select().from(validationDeliveryOutbox); expect(mail!.sentAt).toBeNull(); expect(mail!.attempts).toBe(1);
  await db.insert(notificaciones).values({ rolDestino: 'validador', mensaje: 'Old broadcast' });
  const notices = (await call('ana', 'GET', '/notificaciones')).json(); expect(JSON.stringify(notices)).not.toContain('Old broadcast');
  expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'VALIDACION_COMENTARIOS_ENVIADOS'))).toHaveLength(1);
  expect(await db.select().from(projectAssignments).where(eq(projectAssignments.tipo, 'validador'))).toHaveLength(1);
 });
 it('colección inconsistente conserva la escalación real a Jefatura dentro de la asignación', async () => {
  await assign();
  expect((await call('other', 'POST', `/validaciones/${phaseId}/coleccion`, { motivo: 'La colección no corresponde al contenido.' })).statusCode).toBe(404);
  expect((await call('ana', 'POST', `/validaciones/${phaseId}/coleccion`, { motivo: 'La colección no corresponde al contenido.' })).statusCode).toBe(200);
 });
 it('reasignación durante upload descarta el archivo nuevo y no permite registrar comentarios del anterior', async () => {
  await assign(); const originalUpload = fake.context.storage.uploadFile;
  fake.context.storage.uploadFile = async (input: unknown) => {
   const file = await originalUpload(input);
   expect((await call('chief', 'POST', `/validaciones/${phaseId}/asignar`, { validatorId: other.id })).statusCode).toBe(200);
   return file;
  };
  const result = await call('ana', 'POST', `/validaciones/${phaseId}/archivo`, { name: 'review.pdf', key: randomUUID(), contentBase64: pdf });
  expect(result.statusCode).toBe(404); expect(fake.context.storage.deleteFileOrFolder).toHaveBeenCalledOnce();
  expect((await call('other', 'GET', `/validaciones/${phaseId}`)).json().upload).toBeNull();
 });
 it('muestras/cubiertas externas conservan gates creativos e internos y nunca requieren login de Diseño', async () => {
  const [base] = await db.select().from(disenos).where(eq(disenos.id, designId));
  for (const [type, name] of [['muestra_diagramacion', 'Muestra_V0.pdf'], ['cubierta_extendida', 'Cubierta_V0.pdf']]) {
   const [work] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', businessKey: `qa:${type}` }).returning();
   const [d] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: work!.id, tipo: type!, direccionCreativaId: base!.direccionCreativaId, fuenteUrl: base!.fuenteUrl, solicitudKey: randomUUID() }).returning();
   expect((await call('specialist', 'POST', `/validaciones/diseno/${d!.id}/proveedor`, { name: 'Estudio X', email: 'design@example.test' })).statusCode).toBe(200);
   delivery(0, { name }); expect(await detectValidationDeliveries()).toEqual({ received: 1 });
   const [v] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, d!.id)); expect(v!.entregadoPorId).toBeNull();
   if (type === 'cubierta_extendida') { expect(v!.revisionCreativaId).not.toBeNull(); expect(v!.revisionInternaWorkItemId).not.toBeNull(); expect(v!.aprobadaInternaEn).toBeNull(); }
  }
  for (const role of ['disenador', 'corrector'] as const) {
   const user = await crearUsuario(role); const result = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'password123' } }); expect(result.statusCode).toBe(401);
  }
 });
 it('entrega concurrente de Drive genera una sola ronda y aviso; requiere scope para archivos externos', async () => {
  await assign(); await upload(); expect((await decide('comentarios')).statusCode).toBe(200); delivery(1);
  const results = await Promise.all([detectValidationDeliveries(), detectValidationDeliveries()]); expect(results.reduce((sum, r) => sum + r.received, 0)).toBe(1);
  expect(await db.select().from(disenoVersiones)).toHaveLength(2);
  const [v] = await db.select().from(disenoVersiones).where(and(eq(disenoVersiones.disenoId, designId), eq(disenoVersiones.numero, 1))); phaseId = v!.calidadFaseId!;
  await upload(); expect((await decide('comentarios')).statusCode).toBe(200);
  fake.context.integration.scope = ['https://www.googleapis.com/auth/drive.file'];
  await expect(detectValidationDeliveries()).rejects.toThrow('Reconecta Google Drive');
 });
});
