/** Explicit, read-only real Google check. Not part of npm test. Writes only safe evidence. */
import { readFile,writeFile } from 'node:fs/promises';
import { db,pool } from '../server/db/client.js';
import { externalIntegrations } from '../server/db/schema/index.js';
import { googleDriveConfig } from '../server/modules/integrations/google-drive/config.js';
import { decryptGoogleSecret } from '../server/modules/integrations/google-drive/encryption.js';
import { GoogleDriveOAuth } from '../server/modules/integrations/google-drive/oauth.js';
import { googleDriveService } from '../server/modules/integrations/google-drive/service.js';
import { safeDriveError } from '../server/modules/integrations/google-drive/errors.js';
try {
  const config=googleDriveConfig(),[row]=await db.select().from(externalIntegrations);
  if(!row?.encryptedRefreshToken||row.status!=='connected')throw new Error('Not connected');
  const refresh=decryptGoogleSecret(row.encryptedRefreshToken,config.encryptionKey,'refresh-token');
  const storage=new GoogleDriveOAuth(config).storage({refresh_token:refresh});
  const identity=await storage.validateConnection();
  const status=await googleDriveService.status();
  const visual=JSON.parse(await readFile('docs/evidencias/google-drive/real-smoke.json','utf8'));
  const deletions=[];
  for(const id of new Set([visual.rootId,visual.childId,status.lastTestResult?.rootId,status.lastTestResult?.childId].filter(Boolean))) {
    let confirmed=false;try{await storage.getMetadata(id);}catch(error){if(safeDriveError(error).code!=='NOT_FOUND')throw error;confirmed=true;}
    deletions.push({id,notFound:confirmed});
  }
  const pendingRoots=await storage.listFolders({testRootsOnly:true});
  const result={checkedAt:new Date().toISOString(),accountEmail:identity.accountEmail,connected:status.connected,scope:status.scope,
    offlineRefreshVerified:true,encryptedRefreshProtected:row.encryptedRefreshToken.startsWith('v1.')&&row.encryptedRefreshToken!==refresh,
    pendingTestRoots:pendingRoots.length,deletions,lastEndpointTest:status.lastTestResult};
  await writeFile('docs/evidencias/google-drive/real-status.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
  if(pendingRoots.length||deletions.some(d=>!d.notFound))process.exitCode=1;
}catch(error){console.error(safeDriveError(error).message);process.exitCode=1;}
finally{await pool.end();}
