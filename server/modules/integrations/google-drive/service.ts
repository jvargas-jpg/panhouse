import { randomBytes } from 'node:crypto';
import { and, eq, gt, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { externalIntegrations, googleOAuthAttempts, type DriveTestResult } from '../../../db/schema/index.js';
import { registrarEvento } from '../../../helpers/auditLog.js';
import { hashToken } from '../../../helpers/session.js';
import type { Tx } from '../../../helpers/tx.js';
import { googleDriveConfig, DRIVE_FILE_SCOPE, type GoogleDriveConfig } from './config.js';
import { encryptGoogleSecret, decryptGoogleSecret } from './encryption.js';
import { DriveIntegrationError, safeDriveError } from './errors.js';
import { GoogleDriveOAuth, type DriveOAuthGateway } from './oauth.js';
import { FOLDER_MIME, SMOKE_PURPOSE } from './adapter.js';
import type { DriveStorageProvider } from './provider.js';
import { confirmDriveDeletion } from './cleanup.js';

type Integration = typeof externalIntegrations.$inferSelect;
const provider = 'google_drive';
const whereProvider = eq(externalIntegrations.provider, provider);
export class GoogleDriveService {
  constructor(private configuration = googleDriveConfig, private gateway = (config: GoogleDriveConfig): DriveOAuthGateway => new GoogleDriveOAuth(config)) {}

  private async locked<T>(work: (tx: Tx, row: Integration) => Promise<T>): Promise<T> {
    return db.transaction(async tx => {
      const lock = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(hashtextextended('panhouse:google-drive',0)) as acquired`);
      if (!lock.rows[0]?.acquired) throw new DriveIntegrationError('BUSY');
      await tx.insert(externalIntegrations).values({ provider }).onConflictDoNothing();
      const [row] = await tx.select().from(externalIntegrations).where(whereProvider).for('update');
      if (!row) throw new DriveIntegrationError('GOOGLE_UNAVAILABLE',503);
      return work(tx, row);
    });
  }

  async status() {
    const configured = (() => { try { this.configuration(); return true; } catch { return false; } })();
    const [row] = await db.select().from(externalIntegrations).where(whereProvider);
    const connected = configured && row?.status === 'connected' && !!row.encryptedRefreshToken;
    return { provider, configured, connected, status: !configured ? 'not_configured' : row?.status ?? 'disconnected',
      health: !configured ? 'not_configured' : row?.lastErrorCode ?? (connected && row?.lastValidatedAt ? 'healthy' : 'unverified'),
      accountEmail: row?.accountEmail ?? null, scope: row?.scope ?? [], connectedAt: row?.connectedAt ?? null,
      lastValidatedAt: row?.lastValidatedAt ?? null, lastTestResult: row?.lastTestResult ?? null };
  }

  async connect(userId: string, sessionToken: string) {
    const config = this.configuration(), oauth = this.gateway(config);
    return this.locked(async (tx, row) => {
      await tx.delete(googleOAuthAttempts).where(lt(googleOAuthAttempts.expiresAt,new Date(Date.now()-86_400_000)));
      const attempts = await tx.select({ id: googleOAuthAttempts.id }).from(googleOAuthAttempts).where(and(
        eq(googleOAuthAttempts.userId,userId), gte(googleOAuthAttempts.createdAt,new Date(Date.now()-600_000))));
      if (attempts.length >= 5) throw new DriveIntegrationError('RATE_LIMITED',429);
      const state = randomBytes(32).toString('base64url'), authorization = await oauth.authorization(state);
      await tx.insert(googleOAuthAttempts).values({ stateHash: hashToken(state), sessionHash: hashToken(sessionToken), userId,
        encryptedCodeVerifier: encryptGoogleSecret(authorization.verifier,config.encryptionKey,'oauth-pkce'),
        integrationRevision: row.revision, expiresAt: new Date(Date.now()+600_000) });
      return { authorizationUrl: authorization.url };
    });
  }

  async callback(input: { userId:string; sessionToken:string; state:string; code?:string; denied?:boolean }) {
    const config = this.configuration(), oauth = this.gateway(config);
    // The atomic consume commits before exchanging the code. Failed exchanges cannot replay state.
    const [attempt] = await db.update(googleOAuthAttempts).set({ consumedAt: new Date() }).where(and(
      eq(googleOAuthAttempts.stateHash,hashToken(input.state)),eq(googleOAuthAttempts.userId,input.userId),
      eq(googleOAuthAttempts.sessionHash,hashToken(input.sessionToken)),isNull(googleOAuthAttempts.consumedAt),
      gt(googleOAuthAttempts.expiresAt,new Date()))).returning();
    if (!attempt) throw new DriveIntegrationError('INVALID_STATE',400);
    if (input.denied) throw new DriveIntegrationError('OAUTH_DENIED',403);
    if (!input.code) throw new DriveIntegrationError('OAUTH_FAILED',400);
    const tokens = await oauth.exchange(input.code,decryptGoogleSecret(attempt.encryptedCodeVerifier,config.encryptionKey,'oauth-pkce'));
    await oauth.verifyScopes(tokens);
    const identity = await oauth.storage(tokens).validateConnection();
    await this.locked(async (tx,row) => {
      if (row.revision !== attempt.integrationRevision) throw new DriveIntegrationError('STALE_ATTEMPT');
      let refresh = tokens.refresh_token;
      if (!refresh && row.encryptedRefreshToken && row.oauthClientId === config.clientId && identity.accountId && identity.accountId === row.accountId) {
        refresh = decryptGoogleSecret(row.encryptedRefreshToken,config.encryptionKey,'refresh-token');
      }
      if (!refresh) throw new DriveIntegrationError('REFRESH_TOKEN_REQUIRED');
      // Prove offline credentials work, independently of the short-lived exchange access token.
      const offlineIdentity = await oauth.storage({ refresh_token:refresh }).validateConnection();
      if (identity.accountId && offlineIdentity.accountId !== identity.accountId) throw new DriveIntegrationError('REFRESH_TOKEN_REQUIRED');
      const now = new Date();
      await tx.update(externalIntegrations).set({ status:'connected',encryptedRefreshToken:encryptGoogleSecret(refresh,config.encryptionKey,'refresh-token'),
        accountEmail:identity.accountEmail,accountId:identity.accountId,oauthClientId:config.clientId,scope:[DRIVE_FILE_SCOPE],connectedAt:now,
        connectedByUserId:input.userId,lastValidatedAt:now,lastErrorCode:null,disconnectedAt:null,revision:row.revision+1,updatedAt:now }).where(whereProvider);
      await registrarEvento(tx,{actorId:input.userId,accion:'GOOGLE_DRIVE_CONECTADO',entityType:'external_integration',entityId:row.id,detalles:{scope:DRIVE_FILE_SCOPE}});
    });
  }

  async disconnect(userId:string) {
    return this.locked(async (tx,row) => {
      let warningCode: string | null = null;
      if (row.encryptedRefreshToken) {
        try {
          const config = this.configuration();
          await this.gateway(config).revoke(decryptGoogleSecret(row.encryptedRefreshToken,config.encryptionKey,'refresh-token'));
        } catch (error) { warningCode = safeDriveError(error).code; }
      }
      await tx.update(externalIntegrations).set({status:'disconnected',encryptedRefreshToken:null,accountEmail:null,accountId:null,oauthClientId:null,
        scope:[],disconnectedAt:new Date(),lastErrorCode:warningCode,revision:row.revision+1,updatedAt:new Date()}).where(whereProvider);
      await registrarEvento(tx,{actorId:userId,accion:'GOOGLE_DRIVE_DESCONECTADO',entityType:'external_integration',entityId:row.id,
        detalles:{remoteRevoked:!warningCode,warningCode}});
      return {connected:false,warningCode};
    });
  }

  async test(userId:string, options: {beforeCleanup?:(result:Readonly<DriveTestResult>)=>Promise<void>} = {}): Promise<DriveTestResult> {
    const config = this.configuration(), oauth = this.gateway(config);
    return this.locked(async (tx,row) => {
      if (row.status !== 'connected' || !row.encryptedRefreshToken) throw new DriveIntegrationError('NOT_CONNECTED');
      if (row.lastTestAt && Date.now()-row.lastTestAt.getTime()<10_000) throw new DriveIntegrationError('RATE_LIMITED',429);
      const result: DriveTestResult = {success:false,checkedAt:new Date().toISOString(),cleanedUp:true,rootId:null,rootName:null,childId:null,errorCode:null,cleanupErrorCode:null};
      let storage: DriveStorageProvider | undefined, creationAttempted = false;
      let validatedAt: Date | undefined;
      try {
        storage = oauth.storage({refresh_token:decryptGoogleSecret(row.encryptedRefreshToken,config.encryptionKey,'refresh-token')});
        await storage.validateConnection(); validatedAt = new Date();
        // Recover only our tagged test roots after an interrupted previous request.
        for (const old of await storage.listFolders({testRootsOnly:true})) {
          if (old.appProperties.panhousePurpose === SMOKE_PURPOSE && old.name.startsWith('PANHOUSE_API_TEST_') && old.mimeType === FOLDER_MIME) {
            result.cleanedUp = false;
            await storage.deleteFileOrFolder(old.providerFileId);
            await confirmDriveDeletion(storage,old.providerFileId);
            result.cleanedUp = true;
          }
        }
        result.rootName = `PANHOUSE_API_TEST_${Date.now()}_${randomBytes(4).toString('hex')}`;
        creationAttempted = true; result.cleanedUp = false;
        const root = await storage.createFolder({name:result.rootName,appProperties:{panhousePurpose:SMOKE_PURPOSE}});
        result.rootId = root.providerFileId;
        const child = await storage.createFolder({name:'Prueba API',parentFolderId:root.providerFileId}); result.childId = child.providerFileId;
        const listed = await storage.listFolders({parentFolderId:root.providerFileId});
        const rootMetadata = await storage.getMetadata(root.providerFileId), childMetadata = await storage.getMetadata(child.providerFileId);
        if (!listed.some(f=>f.providerFileId===child.providerFileId) || rootMetadata.name!==result.rootName || rootMetadata.mimeType!==FOLDER_MIME ||
          childMetadata.name!=='Prueba API' || childMetadata.mimeType!==FOLDER_MIME || !childMetadata.parents.includes(root.providerFileId)) throw new DriveIntegrationError('INVALID_RESPONSE',502);
        await registrarEvento(tx,{actorId:userId,accion:'GOOGLE_DRIVE_CARPETA_PRUEBA_CREADA',entityType:'external_integration',entityId:row.id,
          detalles:{rootId:result.rootId,rootName:result.rootName,childId:result.childId}});
        if (options.beforeCleanup) await options.beforeCleanup({...result});
        result.success = true;
      } catch(error) { result.errorCode = safeDriveError(error).code; }
      finally {
        if (storage && result.rootId) {
          try {
            // Try both independently: failure deleting the child must not prevent root cleanup.
            let deletionError: unknown;
            for (const id of [result.childId,result.rootId].filter((id):id is string=>!!id)) {
              try { await storage.deleteFileOrFolder(id); }
              catch(error) { if(safeDriveError(error).code!=='NOT_FOUND')deletionError=error; }
            }
            for (const id of [result.rootId,result.childId].filter((id):id is string=>!!id)) {
              try { await confirmDriveDeletion(storage,id); }
              catch(error) { throw deletionError ?? error; }
            }
            result.cleanedUp = true;
          } catch(error) { result.cleanupErrorCode = safeDriveError(error).code; result.success = false; }
        } else if (creationAttempted) { result.cleanedUp = false; result.cleanupErrorCode = 'CLEANUP_FAILED'; }
      }
      const errorCode = result.errorCode ?? result.cleanupErrorCode;
      await tx.update(externalIntegrations).set({lastTestAt:new Date(result.checkedAt),lastTestResult:result,lastErrorCode:errorCode,
        ...(validatedAt?{lastValidatedAt:validatedAt}:{}),...(errorCode==='REAUTH_REQUIRED'?{status:'error' as const}:{}),updatedAt:new Date()}).where(whereProvider);
      await registrarEvento(tx,{actorId:userId,accion:'GOOGLE_DRIVE_VERIFICADO',entityType:'external_integration',entityId:row.id,detalles:{...result}});
      return result;
    });
  }
}
export const googleDriveService = new GoogleDriveService();
