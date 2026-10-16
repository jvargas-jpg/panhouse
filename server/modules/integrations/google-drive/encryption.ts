import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { DriveIntegrationError } from './errors.js';

export function decodeEncryptionKey(encoded: string | undefined): Buffer {
  if(!encoded||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new DriveIntegrationError('TOKEN_ENCRYPTION_ERROR',503);
  const key=Buffer.from(encoded,'base64');
  if(key.length!==32||key.toString('base64')!==encoded)throw new DriveIntegrationError('TOKEN_ENCRYPTION_ERROR',503);
  return key;
}
export function encryptGoogleSecret(value: string, key: Buffer, purpose: 'refresh-token' | 'oauth-pkce'): string {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('panhouse:google-drive:'+purpose+':v1'));
  const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function decryptGoogleSecret(envelope: string, key: Buffer, purpose: 'refresh-token' | 'oauth-pkce'): string {
  try {
    const parts=envelope.split('.');
    if(parts.length!==4||parts[0]!=='v1'||!parts.slice(1).every(p=>/^[A-Za-z0-9_-]+$/.test(p)))throw new Error('Invalid envelope');
    const iv=Buffer.from(parts[1]!,'base64url'),tag=Buffer.from(parts[2]!,'base64url');
    if(iv.length!==12||tag.length!==16)throw new Error('Invalid envelope');
    const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from('panhouse:google-drive:'+purpose+':v1'));decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(parts[3]!,'base64url')),decipher.final()]).toString('utf8');
  } catch { throw new DriveIntegrationError('TOKEN_ENCRYPTION_ERROR',503); }
}
