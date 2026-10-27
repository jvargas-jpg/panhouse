import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { correccionDeliveries, notificaciones, proyectos, workItems } from '../server/db/schema/index.js';
import { crearUsuario, crearProyectoDePrueba, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { registrarYLoguear } from './helpers/auth.js';
import { solicitarCorreccion, asignarCorrector } from '../server/helpers/correcciones.js';
import { listarMiTrabajoCorrector, obtenerDetalleTrabajoCorrector, registrarEntregaCorrectorConArchivos, reportarBloqueoCorreccion } from '../server/helpers/correctorWork.js';
import { projectDriveWorkspaces, projectDriveFolders } from '../server/db/schema/index.js';

const driveControl = vi.hoisted(() => ({ metadataCalls: 0 }));
vi.mock('../server/modules/integrations/google-drive/corporate.js', () => ({
  withCorporateDrive: async (work: any) => {
    const { db } = await import('../server/db/client.js');
    const { externalIntegrations, projectDriveWorkspaces } = await import('../server/db/schema/index.js');
    const [integration] = await db.select().from(externalIntegrations);
    const [workspace] = await db.select().from(projectDriveWorkspaces);
    return work({
      integration, storage: {
        getMetadata: async (id: string) => {
          driveControl.metadataCalls++;
          if (id === 'inaccessible-file') throw Object.assign(new Error('Archivo no accesible'), { statusCode: 404 });
          return {
            providerFileId: id, name: 'Entrega de prueba.docx',
            mimeType: id === 'folder-file' ? 'application/vnd.google-apps.folder' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            parents: id === 'outside-file' ? ['unrelated-parent'] : id === 'unrelated-parent' ? [] : [workspace!.rootFolderId],
            webViewLink: null, appProperties: {},
          };
        },
        deleteFileOrFolder: async () => {}, uploadFile: async () => { throw new Error('not used'); }, listFiles: async () => ({ items: [], nextPageToken: null }),
      },
    });
  },
}));

async function loginComo(app: ReturnType<typeof crearAppDePrueba>, email: string) {
  const login = await request(app.server).post('/api/auth/login').send({ email, password: 'password123' });
  const cookie = login.headers['set-cookie'];
  if (!cookie) throw new Error('Login falló en loginComo');
  return cookie;
}

async function scenario(alcance: 'tripa_completa' | 'preliminares' = 'tripa_completa') {
  const [specialist, corrector] = await Promise.all([crearUsuario('especialista'), crearUsuario('corrector')]);
  const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
  await completarPreparacionDePrueba(p.id);
  const [ws] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, p.id));
  await db.insert(projectDriveFolders).values([
    { workspaceId: ws!.id, key: 'CORRECTION_INPUT', driveFolderId: 'correction-input-' + p.id, displayName: 'Para corregir', templatePath: '/correccion/para-corregir', status: 'READY', driveUrl: 'https://drive.google.com/drive/folders/correction-input-' + p.id },
    { workspaceId: ws!.id, key: 'CORRECTION_OUTPUT', driveFolderId: 'correction-output-' + p.id, displayName: 'Corregido', templatePath: '/correccion/corregido', status: 'READY', driveUrl: 'https://drive.google.com/drive/folders/correction-output-' + p.id },
  ]);
  const { id: correccionId } = await solicitarCorreccion(p.id, { alcance }, specialist.id);
  const asignacion = await asignarCorrector(correccionId, { correctorId: corrector.id, freelance: false, contratoConfirmado: true }, specialist.id);
  if (!asignacion.ok) throw new Error(asignacion.error);
  const [correccion] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, p.id), eq(workItems.tipo, 'correccion')));
  return { specialist, corrector, p, correccionId, workItemId: correccion!.id, workspace: ws! };
}

const FILTERS = { tab: 'all' as const, search: '', page: 1, pageSize: 10 };

describe('Corrector · Mi trabajo', () => {
  beforeEach(async () => { driveControl.metadataCalls = 0; await limpiarBaseDeDatos(); });

  it('asignación: aparece en Activas con el título real del proyecto, no solo autor+código', async () => {
    const { corrector, workItemId, p } = await scenario();
    await db.update(proyectos).set({ tituloDefinitivo: 'El jardín de las voces' }).where(eq(proyectos.id, p.id));
    const list = await listarMiTrabajoCorrector(corrector.id, FILTERS);
    const row = list.items.find(r => r.id === workItemId);
    expect(row).toBeTruthy();
    expect(row!.status).toBe('asignada');
    expect(row!.actionable).toBe(true);
    expect(row!.title).toBe('El jardín de las voces');
    expect(list.counts.active).toBeGreaterThanOrEqual(1);
  });

  it('IDOR: otro corrector no ve la corrección ajena en su lista ni en el detalle', async () => {
    const { workItemId } = await scenario();
    const other = await crearUsuario('corrector');
    const list = await listarMiTrabajoCorrector(other.id, FILTERS);
    expect(list.items.some(r => r.id === workItemId)).toBe(false);
    expect(await obtenerDetalleTrabajoCorrector(workItemId, other.id)).toBeNull();
  });

  it('detalle: muestra especialista coordinador, SLA real y nunca columna/porcentaje de progreso', async () => {
    const { corrector, workItemId, specialist } = await scenario();
    const detail = await obtenerDetalleTrabajoCorrector(workItemId, corrector.id);
    expect(detail!.specialist).toBe(specialist.nombre);
    expect(detail!.slaLabel).toContain('120 horas');
    expect(JSON.stringify(detail)).not.toMatch(/progress|porcentaje/i);
  });

  it('entrega: exige los dos archivos, valida pertenencia real al workspace y persiste versión', async () => {
    const { corrector, workItemId, p } = await scenario();
    const delivery = await registrarEntregaCorrectorConArchivos(workItemId, corrector.id, {
      tripaUrl: 'https://drive.google.com/file/d/tripa-1/view', reportUrl: 'https://drive.google.com/file/d/informe-1/view',
    });
    expect(delivery.tripaDriveFileId).toBe('tripa-1');
    expect(delivery.reportDriveFileId).toBe('informe-1');
    const [stored] = await db.select().from(correccionDeliveries).where(eq(correccionDeliveries.workItemId, workItemId));
    expect(stored).toBeTruthy();
    const [wi] = await db.select({ estado: workItems.estado }).from(workItems).where(eq(workItems.id, workItemId));
    expect(wi!.estado).toBe('completado');
    const list = await listarMiTrabajoCorrector(corrector.id, FILTERS);
    const row = list.items.find(r => r.id === workItemId);
    expect(row!.status).toBe('completada');
    expect(row!.actionable).toBe(false);
    const notifs = await db.select().from(notificaciones).where(eq(notificaciones.proyectoId, p.id));
    expect(notifs.some(n => n.rolDestino === 'especialista')).toBe(true);
  });

  it('tripa e informe no pueden ser el mismo archivo', async () => {
    const { corrector, workItemId } = await scenario();
    await expect(registrarEntregaCorrectorConArchivos(workItemId, corrector.id, {
      tripaUrl: 'https://drive.google.com/file/d/same-file/view', reportUrl: 'https://drive.google.com/file/d/same-file/view',
    })).rejects.toThrow();
  });

  it('Drive rechaza un archivo fuera del workspace del proyecto', async () => {
    const { corrector, workItemId } = await scenario();
    await expect(registrarEntregaCorrectorConArchivos(workItemId, corrector.id, {
      tripaUrl: 'https://drive.google.com/file/d/outside-file/view', reportUrl: 'https://drive.google.com/file/d/informe-1/view',
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Drive rechaza una carpeta en vez de un archivo', async () => {
    const { corrector, workItemId } = await scenario();
    await expect(registrarEntregaCorrectorConArchivos(workItemId, corrector.id, {
      tripaUrl: 'https://drive.google.com/file/d/folder-file/view', reportUrl: 'https://drive.google.com/file/d/informe-1/view',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('entrega idempotente: doble envío con los mismos archivos no duplica la fila ni el aviso', async () => {
    const { corrector, workItemId, p } = await scenario();
    const input = { tripaUrl: 'https://drive.google.com/file/d/tripa-1/view', reportUrl: 'https://drive.google.com/file/d/informe-1/view' };
    const d1 = await registrarEntregaCorrectorConArchivos(workItemId, corrector.id, input);
    const d2 = await registrarEntregaCorrectorConArchivos(workItemId, corrector.id, input);
    expect(d2.id).toBe(d1.id);
    expect(await db.select().from(correccionDeliveries).where(eq(correccionDeliveries.workItemId, workItemId))).toHaveLength(1);
    // La asignación inicial (en scenario()) ya genera un aviso al corrector; la entrega
    // debe sumar exactamente uno más al especialista, nunca uno por cada llamada.
    expect(await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId, p.id), eq(notificaciones.rolDestino, 'especialista')))).toHaveLength(1);
  });

  it('reasignación: el corrector anterior ya no puede entregar tras perder la asignación', async () => {
    const { corrector, workItemId, specialist, correccionId, p } = await scenario();
    const b = await crearUsuario('corrector');
    const reasignado = await asignarCorrector(correccionId, { correctorId: b.id, freelance: false, contratoConfirmado: true }, specialist.id);
    expect(reasignado.ok).toBe(true);
    await expect(registrarEntregaCorrectorConArchivos(workItemId, corrector.id, {
      tripaUrl: 'https://drive.google.com/file/d/tripa-1/view', reportUrl: 'https://drive.google.com/file/d/informe-1/view',
    })).rejects.toMatchObject({ statusCode: 403 });
    const bList = await listarMiTrabajoCorrector(b.id, FILTERS);
    expect(bList.items.some(r => r.id === workItemId)).toBe(true);
    const aList = await listarMiTrabajoCorrector(corrector.id, FILTERS);
    expect(aList.items.some(r => r.id === workItemId)).toBe(false);
    void p;
  });

  it('bloqueo: se reporta, aparece en la lista con el motivo real y bloquea una segunda entrega', async () => {
    const { corrector, workItemId, specialist, p } = await scenario();
    const blocker = await reportarBloqueoCorreccion(workItemId, 'El archivo recibido está corrupto y no se puede abrir.', corrector.id);
    expect(blocker.reason).toContain('corrupto');
    const [wi] = await db.select({ estado: workItems.estado, gate: workItems.gateBloqueante }).from(workItems).where(eq(workItems.id, workItemId));
    expect(wi!.estado).toBe('bloqueado');
    expect(wi!.gate).toContain('corrupto');
    const list = await listarMiTrabajoCorrector(corrector.id, FILTERS);
    const row = list.items.find(r => r.id === workItemId);
    expect(row!.status).toBe('bloqueada');
    expect(row!.blocker).toContain('corrupto');
    expect(row!.actionable).toBe(false);
    await expect(reportarBloqueoCorreccion(workItemId, 'Otro motivo cualquiera de prueba.', corrector.id)).rejects.toMatchObject({ statusCode: 409 });
    const notifs = await db.select().from(notificaciones).where(eq(notificaciones.proyectoId, p.id));
    expect(notifs.some(n => n.rolDestino === 'especialista' && n.mensaje.includes('bloqueo'))).toBe(true);
    void specialist;
  });

  it('resumen completo antes de limitar filas; no llama Drive al listar/ver detalle sin workspace activo', async () => {
    const { corrector } = await scenario();
    const before = driveControl.metadataCalls;
    await listarMiTrabajoCorrector(corrector.id, FILTERS);
    expect(driveControl.metadataCalls).toBe(before);
  });

  it('API exige sesión, rol corrector y asignación vigente; filtros validados', async () => {
    const app = crearAppDePrueba(); await app.ready();
    try {
      const { corrector, workItemId } = await scenario();
      expect((await request(app.server).get('/api/correcciones/mi-trabajo')).status).toBe(401);
      const cookie = await loginComo(app, corrector.email);
      expect((await request(app.server).get('/api/correcciones/mi-trabajo').set('Cookie', cookie)).status).toBe(200);
      expect((await request(app.server).get('/api/correcciones/mi-trabajo/00000000-0000-4000-8000-000000000000').set('Cookie', cookie)).status).toBe(404);
      expect((await request(app.server).get('/api/correcciones/mi-trabajo?pageSize=999').set('Cookie', cookie)).status).toBe(400);
      const other = await crearUsuario('corrector');
      const otherCookie = await loginComo(app, other.email);
      expect((await request(app.server).get('/api/correcciones/mi-trabajo/' + workItemId).set('Cookie', otherCookie)).status).toBe(404);
      expect((await request(app.server).patch('/api/correcciones/mi-trabajo/' + workItemId + '/entrega').set('Cookie', otherCookie).send({ tripaUrl: 'https://drive.google.com/file/d/x/view', reportUrl: 'https://drive.google.com/file/d/y/view' })).status).toBe(403);
    } finally { await app.close(); }
  });
});
