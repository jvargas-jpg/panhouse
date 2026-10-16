import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../server/config/env.js';
import { DRIVE_FILE_SCOPE, googleDriveConfig } from '../server/modules/integrations/google-drive/config.js';
import { decodeEncryptionKey, decryptGoogleSecret, encryptGoogleSecret } from '../server/modules/integrations/google-drive/encryption.js';
import { safeDriveError } from '../server/modules/integrations/google-drive/errors.js';
import { GoogleDriveOAuth } from '../server/modules/integrations/google-drive/oauth.js';
import { safeRequestUrl } from '../server/modules/integrations/google-drive/logging.js';
import { confirmDriveDeletion } from '../server/modules/integrations/google-drive/cleanup.js';
import { DriveIntegrationError } from '../server/modules/integrations/google-drive/errors.js';
import type { DriveStorageProvider } from '../server/modules/integrations/google-drive/provider.js';

const original = {...env};
afterEach(()=>Object.assign(env,original));
describe('Google Drive · seguridad sin Internet',()=>{
  it('cifra con IV aleatorio y autentica contenido, clave y propósito',()=>{
    const key=randomBytes(32), plaintext='unit-test-refresh-only', a=encryptGoogleSecret(plaintext,key,'refresh-token'),b=encryptGoogleSecret(plaintext,key,'refresh-token');
    expect(a).not.toBe(b);expect(a).not.toContain(plaintext);expect(decryptGoogleSecret(a,key,'refresh-token')).toBe(plaintext);
    expect(()=>decryptGoogleSecret(a,randomBytes(32),'refresh-token')).toThrow();
    expect(()=>decryptGoogleSecret(a,key,'oauth-pkce')).toThrow();
    const parts=a.split('.');parts[2]=randomBytes(16).toString('base64url');expect(()=>decryptGoogleSecret(parts.join('.'),key,'refresh-token')).toThrow();
    expect(()=>decryptGoogleSecret('malformed',key,'refresh-token')).toThrow();
  });
  it('exige clave canónica de 32 bytes',()=>{
    expect(decodeEncryptionKey(randomBytes(32).toString('base64'))).toHaveLength(32);
    for(const value of [undefined,'secret',randomBytes(16).toString('base64'),'!'.repeat(44)])expect(()=>decodeEncryptionKey(value)).toThrow();
  });
  it('config incompleta falla con mensaje seguro sin impedir construir la aplicación',()=>{
    env.GOOGLE_CLIENT_SECRET=undefined;expect(()=>googleDriveConfig()).toThrow('Google Drive integration is not configured.');
  });
  it('rechaza scope ampliado y redirects inseguros',()=>{
    env.GOOGLE_CLIENT_ID='unit-client';env.GOOGLE_CLIENT_SECRET='unit-secret';env.GOOGLE_TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('base64');
    env.GOOGLE_DRIVE_SCOPE='https://www.googleapis.com/auth/drive';expect(()=>googleDriveConfig()).toThrow();env.GOOGLE_DRIVE_SCOPE=DRIVE_FILE_SCOPE;
    for(const redirect of ['https://example.test/other','http://example.test/api/auth/google/callback','http://localhost:3000/api/auth/google/callback?next=evil']){
      env.GOOGLE_REDIRECT_URI=redirect;expect(()=>googleDriveConfig()).toThrow();
    }
  });
  it('URL oficial pide solo drive.file, offline, state y PKCE; no entrega secretos',async()=>{
    const oauth=new GoogleDriveOAuth({clientId:'unit-client',clientSecret:'unit-secret',redirectUri:'http://localhost:3000/api/auth/google/callback',scope:DRIVE_FILE_SCOPE,encryptionKey:randomBytes(32),frontendUrl:'http://localhost:5173'});
    const result=await oauth.authorization('unit-state'), url=new URL(result.url);
    expect(url.origin).toBe('https://accounts.google.com');expect(url.searchParams.get('scope')).toBe(DRIVE_FILE_SCOPE);
    expect(url.searchParams.get('state')).toBe('unit-state');expect(url.searchParams.get('access_type')).toBe('offline');expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(result.url).not.toContain('unit-secret');expect(result.url).not.toContain(result.verifier);
    await expect(oauth.verifyScopes({access_token:'unit-access',scope:DRIVE_FILE_SCOPE})).resolves.toBeUndefined();
    await expect(oauth.verifyScopes({access_token:'unit-access',scope:DRIVE_FILE_SCOPE+' openid'})).rejects.toMatchObject({code:'SCOPE_MISMATCH'});
  });
  it.each([['invalid_grant','REAUTH_REQUIRED'],['invalid_client','INVALID_CLIENT'],['redirect_uri_mismatch','REDIRECT_MISMATCH'],['access_denied','OAUTH_DENIED']])('normaliza %s sin filtrar respuestas SDK', (raw,code)=>{
    const error=safeDriveError({response:{data:{error:raw,access_token:'DO_NOT_LEAK'}},config:{client_secret:'DO_NOT_LEAK'}});
    expect(error.code).toBe(code);expect(JSON.stringify(error)).not.toContain('DO_NOT_LEAK');
  });
  it.each([[401,'REAUTH_REQUIRED'],[403,'DRIVE_ACCESS_DENIED'],[404,'NOT_FOUND'],[429,'RATE_LIMITED'],[503,'GOOGLE_UNAVAILABLE']])('normaliza HTTP %s',(status,code)=>expect(safeDriveError({response:{status}}).code).toBe(code));
  it('quita code/state/error de logs automáticos del callback',()=>{
    expect(safeRequestUrl('/api/auth/google/callback?code=DO_NOT_LEAK&state=DO_NOT_LEAK')).toBe('/api/auth/google/callback');
    expect(safeRequestUrl('/api/proyectos?page=2')).toBe('/api/proyectos?page=2');
  });
  it('cleanup confirma 404 después de metadata temporalmente visible, sin éxito falso',async()=>{
    const getMetadata=vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new DriveIntegrationError('NOT_FOUND',404)),pause=vi.fn(async()=>{});
    await expect(confirmDriveDeletion({getMetadata} as unknown as DriveStorageProvider,'unit-id',pause)).resolves.toBeUndefined();
    expect(getMetadata).toHaveBeenCalledTimes(2);expect(pause).toHaveBeenCalledWith(250);
    getMetadata.mockResolvedValue({});await expect(confirmDriveDeletion({getMetadata} as unknown as DriveStorageProvider,'unit-id',pause)).rejects.toMatchObject({code:'CLEANUP_FAILED'});
    getMetadata.mockRejectedValue(new DriveIntegrationError('REAUTH_REQUIRED'));await expect(confirmDriveDeletion({getMetadata} as unknown as DriveStorageProvider,'unit-id',pause)).rejects.toMatchObject({code:'REAUTH_REQUIRED'});
  });
});
