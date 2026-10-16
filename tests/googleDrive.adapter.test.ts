import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
const sdk=vi.hoisted(()=>({files:{create:vi.fn(),list:vi.fn(),get:vi.fn(),delete:vi.fn(),generateIds:vi.fn()},about:{get:vi.fn()},permissions:{create:vi.fn(),list:vi.fn()}}));
vi.mock('@googleapis/drive',()=>({drive:vi.fn(()=>sdk)}));
import { GoogleDriveAdapter, FOLDER_MIME } from '../server/modules/integrations/google-drive/adapter.js';

describe('Google Drive · adapter oficial mockeado',()=>{
  const adapter=new GoogleDriveAdapter(new OAuth2Client());
  const file={id:'unit-file',name:'Prueba API',mimeType:FOLDER_MIME,parents:['unit-parent']};
  beforeEach(()=>vi.resetAllMocks());
  it('valida cuenta mediante llamada liviana a about.get sin ampliar scope',async()=>{
    sdk.about.get.mockResolvedValue({data:{user:{emailAddress:'unit@example.test',permissionId:'unit-account'}}});
    expect(await adapter.validateConnection()).toEqual({accountEmail:'unit@example.test',accountId:'unit-account'});
    expect(sdk.about.get).toHaveBeenCalledWith({fields:'user(emailAddress,permissionId)'});
  });
  it('crea carpeta con MIME, padre y metadata explícita',async()=>{
    sdk.files.create.mockResolvedValue({data:file});const result=await adapter.createFolder({name:'Prueba API',parentFolderId:'unit-parent'});
    expect(sdk.files.create).toHaveBeenCalledWith(expect.objectContaining({requestBody:{name:'Prueba API',mimeType:FOLDER_MIME,parents:['unit-parent']}}));
    expect(result).toMatchObject({providerFileId:'unit-file',parents:['unit-parent'],webViewLink:null});
  });
  it('lista todas las páginas y escapa padre en query',async()=>{
    sdk.files.list.mockResolvedValueOnce({data:{files:[file],nextPageToken:'page-2'}}).mockResolvedValueOnce({data:{files:[{...file,id:'unit-2'}]}});
    expect(await adapter.listFolders({parentFolderId:"parent'quoted"})).toHaveLength(2);
    expect(sdk.files.list.mock.calls[0]![0].q).toContain("'parent\\'quoted' in parents");
    expect(sdk.files.list.mock.calls[1]![0].pageToken).toBe('page-2');
  });
  it('recupera únicamente carpetas de smoke etiquetadas por la app',async()=>{
    sdk.files.list.mockResolvedValue({data:{files:[]}});await adapter.listFolders({testRootsOnly:true});
    expect(sdk.files.list.mock.calls[0]![0].q).toContain("appProperties has { key='panhousePurpose'");
  });
  it('metadata y eliminación usan IDs propios; respuesta incompleta no se inventa',async()=>{
    sdk.files.get.mockResolvedValue({data:file});expect((await adapter.getMetadata('unit-file')).name).toBe('Prueba API');
    sdk.files.delete.mockResolvedValue({});await adapter.deleteFileOrFolder('unit-file');expect(sdk.files.delete).toHaveBeenCalledWith({fileId:'unit-file',supportsAllDrives:true});
    sdk.files.create.mockResolvedValue({data:{id:'incomplete'}});await expect(adapter.createFolder({name:'x'})).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });
  it('errores SDK no filtran credenciales',async()=>{
    sdk.files.get.mockRejectedValue({response:{status:401},config:{headers:{authorization:'DO_NOT_LEAK'}}});
    await expect(adapter.getMetadata('unit-file')).rejects.toMatchObject({code:'REAUTH_REQUIRED'});
  });
  it('reserva IDs oficiales y los usa al crear carpetas idempotentes',async()=>{
    sdk.files.generateIds.mockResolvedValue({data:{ids:['reserved-id']}});expect(await adapter.allocateFolderIds(1)).toEqual(['reserved-id']);
    expect(sdk.files.generateIds).toHaveBeenCalledWith({count:1,space:'drive',type:'files'});
    sdk.files.create.mockResolvedValue({data:{...file,id:'reserved-id'}});await adapter.createFolder({name:'Prueba API',providerFileId:'reserved-id',parentFolderId:'unit-parent'});
    expect(sdk.files.create).toHaveBeenCalledWith(expect.objectContaining({requestBody:expect.objectContaining({id:'reserved-id',parents:['unit-parent']}),supportsAllDrives:true}));
  });
  it('rechaza reservas vacías, duplicadas e inválidas',async()=>{
    await expect(adapter.allocateFolderIds(0)).rejects.toBeDefined();sdk.files.generateIds.mockResolvedValue({data:{ids:['one','one']}});
    await expect(adapter.allocateFolderIds(2)).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });
  it('sharing preparado concede writer sobre un solo ID sin enviar notificación',async()=>{
    sdk.permissions.create.mockResolvedValue({data:{id:'unit-permission',emailAddress:'fixture@example.test',role:'writer'}});
    expect(await adapter.shareFolder('unit-root','fixture@example.test')).toEqual({permissionId:'unit-permission',email:'fixture@example.test',role:'writer'});
    expect(sdk.permissions.create).toHaveBeenCalledWith(expect.objectContaining({fileId:'unit-root',sendNotificationEmail:false,requestBody:{type:'user',role:'writer',emailAddress:'fixture@example.test'}}));
  });
  it('consulta permisos mínimos para una validación posterior de sharing',async()=>{
    sdk.permissions.list.mockResolvedValue({data:{permissions:[{id:'unit-permission',emailAddress:'fixture@example.test',role:'writer'}]}});
    expect(await adapter.listFolderPermissions('unit-root')).toEqual([{permissionId:'unit-permission',email:'fixture@example.test',role:'writer'}]);
  });
});
