import { eq } from 'drizzle-orm';
import { db,pool } from '../../../db/client.js';
import { externalIntegrations } from '../../../db/schema/index.js';
import { googleDriveConfig } from './config.js';
import { decryptGoogleSecret } from './encryption.js';
import { DriveIntegrationError } from './errors.js';
import { GoogleDriveOAuth } from './oauth.js';
import type { ProjectDriveStorageProvider } from './provider.js';

export type CorporateDriveOperation = <T>(work:(context:{integration:typeof externalIntegrations.$inferSelect;storage:ProjectDriveStorageProvider})=>Promise<T>)=>Promise<T>;
/** Same advisory key as OAuth/disconnect. Short DB transactions inside work; no distributed transaction claim. */
export const withCorporateDrive:CorporateDriveOperation = async work=>{
  const lease=await pool.connect();let acquired=false,destroy=false;
  try{
    const result=await lease.query<{acquired:boolean}>("select pg_try_advisory_lock(hashtextextended('panhouse:google-drive',0)) as acquired");
    acquired=!!result.rows[0]?.acquired;if(!acquired)throw new DriveIntegrationError('BUSY');
    const [integration]=await db.select().from(externalIntegrations).where(eq(externalIntegrations.provider,'google_drive'));
    if(integration?.status!=='connected'||!integration.encryptedRefreshToken)throw new DriveIntegrationError('NOT_CONNECTED');
    const config=googleDriveConfig();
    const storage=new GoogleDriveOAuth(config).workspaceStorage({refresh_token:decryptGoogleSecret(integration.encryptedRefreshToken,config.encryptionKey,'refresh-token')});
    return await work({integration,storage});
  }finally{
    try{if(acquired)await lease.query("select pg_advisory_unlock(hashtextextended('panhouse:google-drive',0))");}
    catch{destroy=true;}
    finally{lease.release(destroy);}
  }
};
