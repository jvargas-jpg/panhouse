/** Isolated, repeatable browser QA. Real SQL/domain/API; simulated Drive only.
 * DATABASE_URL must point to a disposable database named *_validation_preview.
 * Never starts workers, sends real mail, or connects to the corporate Drive.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.endsWith('_validation_preview')) throw Error('Use an isolated local *_validation_preview database');
process.env.NODE_ENV = 'development'; process.env.APP_FRONTEND_URL = 'http://127.0.0.1:5176';
const { db } = await import('../server/db/client.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
const schema = await import('../server/db/schema/index.js');
const { crearUsuario, crearProyectoDePrueba, completarPreparacionDePrueba } = await import('../tests/helpers/fixtures.js');
const { detectValidationDeliveries, deliverValidationMail } = await import('../server/helpers/validationDrive.js');
const { limpiarBaseDeDatos } = await import('../tests/helpers/db.js');
await limpiarBaseDeDatos();
const specialist = await crearUsuario('especialista'), chief = await crearUsuario('jefe_area'), ana = await crearUsuario('validador');
await db.update(schema.users).set({ nombre: 'Especialista QA', email: 'especialista@validadores.qa.test' }).where(eq(schema.users.id, specialist.id));
await db.update(schema.users).set({ nombre: 'Jefatura QA', email: 'jefatura@validadores.qa.test' }).where(eq(schema.users.id, chief.id));
await db.update(schema.users).set({ nombre: 'Ana · Validadora QA', email: 'ana@validadores.qa.test' }).where(eq(schema.users.id, ana.id));
const project = await crearProyectoDePrueba({ especialistaId: specialist.id }); await completarPreparacionDePrueba(project.id);
await db.update(schema.proyectos).set({ tituloDefinitivo: 'El libro de Elisa Vega' }).where(eq(schema.proyectos.id, project.id));
await db.update(schema.autores).set({ nombre: 'Elisa Vega' }).where(eq(schema.autores.id, project.autorId));
const [cw] = await db.insert(schema.workItems).values({ proyectoId: project.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
const [creative] = await db.insert(schema.direccionesCreativas).values({ proyectoId: project.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
const [dw] = await db.insert(schema.workItems).values({ proyectoId: project.id, tipo: 'diseno', estado: 'en_progreso' }).returning();
await db.insert(schema.disenos).values({ proyectoId: project.id, workItemId: dw!.id, tipo: 'diagramacion', direccionCreativaId: creative!.id, solicitudKey: randomUUID(), fuenteUrl: 'https://drive.google.com/file/d/source-qa/view', externalProviderName: 'Estudio X', externalProviderEmail: 'design@validadores.qa.test' });
const [w] = await db.select().from(schema.projectDriveWorkspaces).where(eq(schema.projectDriveWorkspaces.projectId, project.id));
const [integration] = await db.select().from(schema.externalIntegrations).where(eq(schema.externalIntegrations.id, w!.integrationId));
const folder = 'versions-qa';
for (const [key, id] of [['DESIGN_REVIEW_VERSIONS', folder], ['QUALITY_COMMENTS', 'comments-qa']]) await db.insert(schema.projectDriveFolders).values({ workspaceId: w!.id, key: key!, driveFolderId: id!, displayName: key!, templatePath: key!, status: 'READY' });
const { DRIVE_DELIVERY_SCOPE } = await import('../server/modules/integrations/google-drive/config.js');
const files: import('../server/modules/integrations/google-drive/provider.js').StorageItem[] = [];
const drive: import('../server/modules/integrations/google-drive/corporate.js').CorporateDriveOperation = async fn => fn({ integration: { ...integration!, scope: [DRIVE_DELIVERY_SCOPE] }, storage: {
 getMetadata: async id => files.find(f => f.providerFileId === id)!,
 listFiles: async () => ({ items: files, nextPageToken: null }),
 pinAuthorRevision: async () => ({ revisionId: 'qa-exact-revision', mimeType: 'application/pdf' }),
 readAuthorRevision: async () => Buffer.from('%PDF-1.7\nQA fixture\n%%EOF'),
 uploadFile: async input => ({ providerFileId: randomUUID(), name: input.name, mimeType: input.mimeType, webViewLink: null, parents: [input.parentFolderId], appProperties: {} }),
 deleteFileOrFolder: async () => {}, allocateFolderIds: async () => [], createFolder: async () => { throw Error('Not a QA operation'); }, listFolders: async () => [], validateConnection: async () => ({ accountEmail: null, accountId: null }), shareFolder: async () => { throw Error('Not a QA operation'); }, listFolderPermissions: async () => [],
} });
async function deliver(n: number) {
 files.push({ providerFileId: `qa-v${n}`, name: `V${n}.pdf`, mimeType: 'application/pdf', size: 100, parents: [folder], appProperties: {}, webViewLink: null, contributorEmails: ['design@validadores.qa.test'], modifiedAt: new Date(Date.now() + 1000).toISOString() });
 return detectValidationDeliveries(drive);
}
await deliver(0);
const { buildApp } = await import('../server/app.js');
const app = buildApp({ validationDrive: drive });
// Local QA controls are mounted only in this disposable harness.
app.get('/__qa/context', async () => ({ projectId: project.id }));
app.post('/__qa/design/:number', async req => deliver(Number((req.params as { number: string }).number)));
app.post('/__qa/mail', async () => { const recipients: string[] = []; await deliverValidationMail(async m => { recipients.push(m.recipient); }); return { simulated: true, recipients }; });
await app.listen({ host: '127.0.0.1', port: 3015 });
console.log('QA API 3015 · ana@validadores.qa.test / password123 · simulated Drive, no real mail.');
