import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { env } from '../server/config/env.js';
import { db } from '../server/db/client.js';
import { auditLogs, externalIntegrations, googleOAuthAttempts, users } from '../server/db/schema/index.js';
import { createSession, hashToken } from '../server/helpers/session.js';
import { GoogleDriveOAuth } from '../server/modules/integrations/google-drive/oauth.js';
import { DRIVE_FILE_SCOPE } from '../server/modules/integrations/google-drive/config.js';
import { decryptGoogleSecret } from '../server/modules/integrations/google-drive/encryption.js';
import { DriveIntegrationError } from '../server/modules/integrations/google-drive/errors.js';
import { FOLDER_MIME } from '../server/modules/integrations/google-drive/adapter.js';
import type { StorageItem } from '../server/modules/integrations/google-drive/provider.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

describe('Google Drive · rutas, persistencia y proveedor aislado de Internet',()=>{
  const app=buildApp(), original={...env};
  let userId:string, cookie:string, token:string;
  const items=new Map<string,StorageItem>();
  const identity={accountEmail:'corporate@example.test',accountId:'unit-account'};
  const storage={
    validateConnection:vi.fn(async()=>identity),
    createFolder:vi.fn(async(input:{name:string;parentFolderId?:string;appProperties?:Record<string,string>})=>{
      const item:StorageItem={providerFileId:randomUUID(),name:input.name,mimeType:FOLDER_MIME,parents:input.parentFolderId?[input.parentFolderId]:[],webViewLink:null,appProperties:input.appProperties ?? {}};
      items.set(item.providerFileId,item);return item;
    }),
    listFolders:vi.fn(async(input:{parentFolderId?:string;testRootsOnly?:boolean})=>[...items.values()].filter(i=>input.testRootsOnly?!!i.appProperties.panhousePurpose:i.parents.includes(input.parentFolderId!))),
    getMetadata:vi.fn(async(id:string)=>{const item=items.get(id);if(!item)throw new DriveIntegrationError('NOT_FOUND',404);return item;}),
    deleteFileOrFolder:vi.fn(async(id:string)=>{items.delete(id);for(const [child,item]of items)if(item.parents.includes(id))items.delete(child);}),
  };
  const post=(action:string,auth=cookie,payload:unknown={})=>app.inject({method:'POST',url:'/api/integrations/google-drive/'+action,headers:{cookie:auth},payload:payload as Record<string,unknown>});
  const state=async()=>new URL((await post('connect')).json().authorizationUrl).searchParams.get('state')!;
  const callback=(value:string,extra='code=unit-code',auth=cookie)=>app.inject({method:'GET',url:'/api/auth/google/callback?state='+value+'&'+extra,headers:{cookie:auth}});
  const row=async()=>(await db.select().from(externalIntegrations))[0]!;
  const connected=async()=>{const response=await callback(await state());expect(response.headers.location).toContain('googleDrive=connected');};
  beforeAll(()=>app.ready());afterAll(()=>app.close());
  afterEach(()=>{vi.restoreAllMocks();Object.assign(env,original);});
  beforeEach(async()=>{
    await limpiarBaseDeDatos();items.clear();vi.clearAllMocks();
    Object.assign(env,{GOOGLE_CLIENT_ID:'unit-client',GOOGLE_CLIENT_SECRET:'unit-secret',GOOGLE_REDIRECT_URI:'http://localhost:3000/api/auth/google/callback',GOOGLE_DRIVE_SCOPE:DRIVE_FILE_SCOPE,GOOGLE_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),APP_FRONTEND_URL:'http://localhost:5173'});
    const [user]=await db.insert(users).values({nombre:'Dirección Prueba',rol:'direccion',email:randomUUID()+'@test.local',passwordHash:'session-only'}).returning();userId=user!.id;
    token=await createSession(userId);cookie='panhouse_sid='+token;
    vi.spyOn(GoogleDriveOAuth.prototype,'authorization').mockImplementation(async state=>({url:'https://accounts.google.com/o/oauth2/v2/auth?state='+state,verifier:'unit-pkce-verifier'}));
    vi.spyOn(GoogleDriveOAuth.prototype,'exchange').mockResolvedValue({access_token:'unit-access-secret',refresh_token:'unit-refresh-secret',scope:DRIVE_FILE_SCOPE});
    vi.spyOn(GoogleDriveOAuth.prototype,'verifyScopes').mockResolvedValue();
    vi.spyOn(GoogleDriveOAuth.prototype,'storage').mockReturnValue(storage);
    vi.spyOn(GoogleDriveOAuth.prototype,'revoke').mockResolvedValue();
  });
  it('status inicial no inventa conexión ni filtra secretos',async()=>{
    const response=await app.inject({method:'GET',url:'/api/integrations/google-drive/status',headers:{cookie}});
    expect(response.json()).toMatchObject({connected:false,configured:true,status:'disconnected',lastValidatedAt:null});expect(response.headers['cache-control']).toBe('no-store');
  });
  it('faltan env: error claro, app viva',async()=>{
    env.GOOGLE_CLIENT_SECRET=undefined;expect((await post('connect')).json()).toMatchObject({code:'NOT_CONFIGURED',error:'Google Drive integration is not configured.'});
    expect((await app.inject({method:'GET',url:'/health'})).statusCode).toBe(200);
  });
  it('requiere autenticación y Dirección en todas las capacidades',async()=>{
    const [u]=await db.insert(users).values({nombre:'Especialista',rol:'especialista',email:randomUUID()+'@test.local',passwordHash:'session-only'}).returning();
    const specialist='panhouse_sid='+await createSession(u!.id);
    for(const action of ['connect','test','disconnect']){expect((await post(action,'')).statusCode).toBe(401);expect((await post(action,specialist)).statusCode).toBe(403);}
    for(const url of ['/api/integrations/google-drive/status','/api/auth/google/callback?state=unit'])expect((await app.inject({method:'GET',url,headers:{cookie:specialist}})).statusCode).toBe(403);
    expect(GoogleDriveOAuth.prototype.exchange).not.toHaveBeenCalled();
  });
  it('rechaza origen ajeno y payload arbitrario',async()=>{
    expect((await app.inject({method:'POST',url:'/api/integrations/google-drive/connect',headers:{cookie,origin:'https://evil.test'},payload:{}})).statusCode).toBe(403);
    expect((await post('test',cookie,{folderId:'other-file'})).statusCode).toBe(400);
  });
  it('state seguro solo persiste hash, PKCE cifrado y sesión original',async()=>{
    const value=await state(), [attempt]=await db.select().from(googleOAuthAttempts);
    expect(value.length).toBeGreaterThanOrEqual(43);expect(attempt).toMatchObject({stateHash:hashToken(value),sessionHash:hashToken(token),userId,consumedAt:null});
    expect(attempt!.encryptedCodeVerifier).not.toContain('unit-pkce-verifier');expect(attempt!.expiresAt.getTime()-Date.now()).toBeLessThanOrEqual(600_000);
  });
  it('state correcto conecta, verifica offline y solo persiste refresh cifrado',async()=>{
    await connected();const integration=await row();expect(integration.status).toBe('connected');expect(integration.scope).toEqual([DRIVE_FILE_SCOPE]);
    expect(integration.encryptedRefreshToken).not.toContain('unit-refresh-secret');
    expect(decryptGoogleSecret(integration.encryptedRefreshToken!,Buffer.from(env.GOOGLE_TOKEN_ENCRYPTION_KEY!,'base64'),'refresh-token')).toBe('unit-refresh-secret');
    expect(GoogleDriveOAuth.prototype.storage).toHaveBeenCalledWith({refresh_token:'unit-refresh-secret'});
    const response=await app.inject({method:'GET',url:'/api/integrations/google-drive/status',headers:{cookie}});
    expect(response.json()).toMatchObject({connected:true,accountEmail:identity.accountEmail,health:'healthy'});expect(response.body).not.toMatch(/unit-refresh|unit-access|encryptedRefresh|clientSecret/);
    expect((await db.select().from(auditLogs)).some(e=>e.accion==='GOOGLE_DRIVE_CONECTADO')).toBe(true);
  });
  it('state incorrecto, ausente, expirado y reutilizado no intercambian credenciales',async()=>{
    expect((await callback('x'.repeat(43))).headers.location).toContain('INVALID_STATE');
    expect((await app.inject({method:'GET',url:'/api/auth/google/callback?code=unit',headers:{cookie}})).headers.location).toContain('INVALID_STATE');
    const expired=await state();await db.update(googleOAuthAttempts).set({expiresAt:new Date(Date.now()-1)});
    expect((await callback(expired)).headers.location).toContain('INVALID_STATE');expect(GoogleDriveOAuth.prototype.exchange).not.toHaveBeenCalled();
    const valid=await state();await callback(valid);expect((await callback(valid)).headers.location).toContain('INVALID_STATE');expect(GoogleDriveOAuth.prototype.exchange).toHaveBeenCalledTimes(1);
  });
  it('otra sesión y otro usuario no pueden consumir state',async()=>{
    const value=await state(),otherSession='panhouse_sid='+await createSession(userId);
    expect((await callback(value,'code=unit',otherSession)).headers.location).toContain('INVALID_STATE');
    const [u]=await db.insert(users).values({nombre:'Otra Dirección',rol:'direccion',email:randomUUID()+'@test.local',passwordHash:'session-only'}).returning();
    expect((await callback(value,'code=unit','panhouse_sid='+await createSession(u!.id))).headers.location).toContain('INVALID_STATE');
    expect((await callback(value)).headers.location).toContain('googleDrive=connected');
  });
  it('denegación consume state y redirige solo al frontend fijo',async()=>{
    const value=await state(),response=await callback(value,'error=access_denied&redirect=https://evil.test');
    expect(response.headers.location).toBe('http://localhost:5173/configuracion/integraciones/google-drive?googleDriveError=OAUTH_DENIED');
    expect(GoogleDriveOAuth.prototype.exchange).not.toHaveBeenCalled();expect((await callback(value)).headers.location).toContain('INVALID_STATE');
  });
  it('intercambio fallido consume state y no filtra error SDK',async()=>{
    vi.mocked(GoogleDriveOAuth.prototype.exchange).mockRejectedValue({response:{data:{error:'invalid_client',client_secret:'DO_NOT_LEAK'}}});
    const value=await state(),response=await callback(value);expect(response.headers.location).toContain('INVALID_CLIENT');expect(response.body).not.toContain('DO_NOT_LEAK');
    expect((await callback(value)).headers.location).toContain('INVALID_STATE');
  });
  it('scope rechazado no persiste conexión',async()=>{
    vi.mocked(GoogleDriveOAuth.prototype.verifyScopes).mockRejectedValue(new DriveIntegrationError('SCOPE_MISMATCH'));
    expect((await callback(await state())).headers.location).toContain('SCOPE_MISMATCH');expect((await row()).encryptedRefreshToken).toBeNull();
  });
  it('sin refresh en primera conexión no guarda integración inútil',async()=>{
    vi.mocked(GoogleDriveOAuth.prototype.exchange).mockResolvedValue({access_token:'unit-access'});
    expect((await callback(await state())).headers.location).toContain('REFRESH_TOKEN_REQUIRED');expect((await row()).status).toBe('disconnected');
  });
  it('reutiliza refresh previo exclusivamente de la misma cuenta y cliente',async()=>{
    await connected();vi.mocked(GoogleDriveOAuth.prototype.exchange).mockResolvedValue({access_token:'unit-access'});
    await connected();expect((await row()).encryptedRefreshToken).toBeTruthy();
    storage.validateConnection.mockResolvedValueOnce({...identity,accountId:'another-account'});
    expect((await callback(await state())).headers.location).toContain('REFRESH_TOKEN_REQUIRED');
    await db.update(externalIntegrations).set({oauthClientId:'different-client'});
    expect((await callback(await state())).headers.location).toContain('REFRESH_TOKEN_REQUIRED');
  });
  it('desconexión invalida intentos anteriores y elimina credencial aunque falle revocación',async()=>{
    await connected();const value=await state();vi.mocked(GoogleDriveOAuth.prototype.revoke).mockRejectedValue(new Error('DO_NOT_LEAK'));
    expect((await post('disconnect')).json()).toEqual({connected:false,warningCode:'GOOGLE_UNAVAILABLE'});
    expect(await row()).toMatchObject({status:'disconnected',encryptedRefreshToken:null});expect(storage.deleteFileOrFolder).not.toHaveBeenCalled();
    expect((await callback(value)).headers.location).toContain('STALE_ATTEMPT');expect((await row()).encryptedRefreshToken).toBeNull();
  });
  it('prueba crea raíz y subcarpeta, verifica listado/metadata y confirma limpieza',async()=>{
    await connected();const response=await post('test');expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({success:true,cleanedUp:true,errorCode:null,cleanupErrorCode:null});expect(response.json().rootName).toMatch(/^PANHOUSE_API_TEST_/);
    expect(storage.createFolder).toHaveBeenCalledTimes(2);expect(items.size).toBe(0);expect((await row()).lastTestResult).toMatchObject({success:true});
    expect((await post('test')).statusCode).toBe(429);
    const events=await db.select().from(auditLogs);expect(events.some(e=>e.accion==='GOOGLE_DRIVE_VERIFICADO')).toBe(true);expect(JSON.stringify(events)).not.toMatch(/unit-refresh|unit-access|unit-secret/);
  });
  it('fallo parcial limpia raíz y registra resultado fallido sin rollback',async()=>{
    await connected();storage.createFolder.mockRejectedValueOnce(new DriveIntegrationError('GOOGLE_UNAVAILABLE'));
    const response=await post('test');expect(response.json()).toMatchObject({success:false,cleanedUp:false,errorCode:'GOOGLE_UNAVAILABLE'});
    expect((await row()).lastTestResult).toMatchObject({success:false});
  });
  it('fallo de subcarpeta limpia la raíz ya creada',async()=>{
    await connected();const create=storage.createFolder.getMockImplementation()!;
    storage.createFolder.mockImplementationOnce(create).mockRejectedValueOnce(new DriveIntegrationError('DRIVE_ACCESS_DENIED'));
    expect((await post('test')).json()).toMatchObject({success:false,cleanedUp:true,errorCode:'DRIVE_ACCESS_DENIED'});expect(items.size).toBe(0);
  });
  it('cleanup fallido queda persistido y la siguiente prueba recupera solo raíces etiquetadas',async()=>{
    await connected();storage.deleteFileOrFolder.mockRejectedValueOnce(new DriveIntegrationError('GOOGLE_UNAVAILABLE')).mockRejectedValueOnce(new DriveIntegrationError('GOOGLE_UNAVAILABLE'));
    expect((await post('test')).json()).toMatchObject({success:false,cleanedUp:false,cleanupErrorCode:'GOOGLE_UNAVAILABLE'});expect(items.size).toBe(2);
    await db.update(externalIntegrations).set({lastTestAt:new Date(Date.now()-20_000)});
    expect((await post('test')).json()).toMatchObject({success:true,cleanedUp:true});expect(items.size).toBe(0);
  });
  it('credencial revocada degrada salud y solicita reconexión',async()=>{
    await connected();storage.validateConnection.mockRejectedValueOnce(new DriveIntegrationError('REAUTH_REQUIRED'));
    expect((await post('test')).json()).toMatchObject({success:false,errorCode:'REAUTH_REQUIRED'});expect((await row()).status).toBe('error');
  });
  it('limita intentos OAuth por usuario',async()=>{for(let n=0;n<5;n++)await state();expect((await post('connect')).statusCode).toBe(429);});
});
