import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { auditLogs, externalIntegrations, projectDriveFolders, projectDriveWorkspaces, proyectos, reunionesExtraccion, users } from '../server/db/schema/index.js';
import { registrarVideoSesion } from '../server/helpers/extraccion.js';
import { DriveIntegrationError } from '../server/modules/integrations/google-drive/errors.js';
import type { CorporateDriveOperation } from '../server/modules/integrations/google-drive/corporate.js';
import type { ProjectDriveStorageProvider, StorageItem } from '../server/modules/integrations/google-drive/provider.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { completarPreparacionDePrueba, crearProyectoDePrueba } from './helpers/fixtures.js';

beforeEach(limpiarBaseDeDatos);
async function fixture() {
  const [editor]=await db.insert(users).values({nombre:'Editor',rol:'editor',email:'editor@video.test',passwordHash:'session-only'}).returning();
  const project=await crearProyectoDePrueba();
  await db.update(proyectos).set({editorId:editor!.id}).where(eq(proyectos.id,project.id));
  await completarPreparacionDePrueba(project.id);
  const [workspace]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,project.id));
  await db.insert(projectDriveFolders).values({workspaceId:workspace!.id,key:'CONTENT_EXTRACTIONS',driveFolderId:'extractions-folder',displayName:'Extracciones',templatePath:'/Edición/Extracciones',status:'READY'});
  const [reunion]=await db.update(reunionesExtraccion).set({videoUrl:null}).where(eq(reunionesExtraccion.proyectoId,project.id)).returning();
  const [integration]=await db.select().from(externalIntegrations);
  const copied:StorageItem={providerFileId:'copied-video',name:'Grabación',mimeType:'video/mp4',parents:['chapter-folder'],webViewLink:null,appProperties:{}};
  const storage={listFolders:vi.fn(async()=>[{...copied,providerFileId:'chapter-folder',mimeType:'application/vnd.google-apps.folder',appProperties:{key:'CAPITULO_1'}}]),copyFile:vi.fn(async()=>copied),importPublicVideo:vi.fn(async()=>copied)};
  const operate:CorporateDriveOperation=async work=>work({integration:integration!,storage:storage as unknown as ProjectDriveStorageProvider});
  const save=()=>registrarVideoSesion(project.id,reunion!.id,{videoUrl:'https://drive.google.com/file/d/public-video-id/view?resourcekey=key'},{id:editor!.id,rol:'editor'},operate);
  return {save,storage,reunion,project};
}
describe('Grabaciones de extracción',()=>{
  it('prefiere copia interna y registra solo el archivo ya guardado',async()=>{
    const f=await fixture();const result=await f.save();
    expect(result.videoUrl).toBe('https://drive.google.com/file/d/copied-video/view');
    expect(f.storage.copyFile).toHaveBeenCalledWith({fileId:'public-video-id',name:'Grabación · Capítulo 1',parentFolderId:'chapter-folder',resourceKey:'key'});
    expect(f.storage.importPublicVideo).not.toHaveBeenCalled();
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'EXTRACCION_SESION_ARCHIVO_SUBIDO'))).toHaveLength(1);
  });
  it.each(['NOT_FOUND','DRIVE_ACCESS_DENIED'] as const)('importa el video público cuando la copia falla con %s',async(code)=>{
    const f=await fixture();f.storage.copyFile.mockRejectedValue(new DriveIntegrationError(code));
    expect((await f.save()).videoUrl).toContain('copied-video');
    expect(f.storage.importPublicVideo).toHaveBeenCalledWith(expect.objectContaining({fileId:'public-video-id',parentFolderId:'chapter-folder',resourceKey:'key'}));
  });
  it('no oculta fallos transitorios intentando otra carga',async()=>{
    const f=await fixture();f.storage.copyFile.mockRejectedValue(new DriveIntegrationError('GOOGLE_UNAVAILABLE'));
    await expect(f.save()).rejects.toMatchObject({code:'GOOGLE_UNAVAILABLE'});
    expect(f.storage.importPublicVideo).not.toHaveBeenCalled();
  });
  it('distingue descarga bloqueada y no marca el video como guardado',async()=>{
    const f=await fixture();f.storage.copyFile.mockRejectedValue(new DriveIntegrationError('NOT_FOUND'));
    f.storage.importPublicVideo.mockRejectedValue(new DriveIntegrationError('PUBLIC_VIDEO_UNAVAILABLE',400));
    await expect(f.save()).rejects.toMatchObject({status:400,message:expect.stringContaining('descargar y copiar')});
    const [reunion]=await db.select().from(reunionesExtraccion).where(eq(reunionesExtraccion.id,f.reunion!.id));
    expect(reunion!.videoUrl).toBeNull();
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion,'EXTRACCION_SESION_ARCHIVO_SUBIDO'))).toHaveLength(0);
  });
  it('identifica un fallo de escritura en la carpeta de destino',async()=>{
    const f=await fixture();f.storage.copyFile.mockRejectedValue(new DriveIntegrationError('NOT_FOUND'));
    f.storage.importPublicVideo.mockRejectedValue(new DriveIntegrationError('DRIVE_ACCESS_DENIED'));
    await expect(f.save()).rejects.toMatchObject({status:409,message:expect.stringContaining('carpeta de destino')});
  });
});
