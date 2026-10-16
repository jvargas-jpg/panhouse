/** Explicit manual smoke: waits briefly for visual inspection, always cleans up. No tokens are printed. */
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { googleDriveService } from '../server/modules/integrations/google-drive/service.js';
import { safeDriveError } from '../server/modules/integrations/google-drive/errors.js';

const folder=join(tmpdir(),'panhouse-drive-smoke'),signal=join(folder,'cleanup.signal');
try {
  const actorId=process.env.PANHOUSE_DRIVE_ACTOR_ID;
  if(!actorId)throw new Error('PANHOUSE_DRIVE_ACTOR_ID must identify an existing active Dirección user.');
  const actor=await db.query.users.findFirst({where:eq(users.id,actorId)});
  if(!actor?.activo||actor.rol!=='direccion')throw new Error('An active Dirección user is required.');
  await mkdir(folder,{recursive:true});await unlink(signal).catch(()=>{});
  const result=await googleDriveService.test(actor.id,{beforeCleanup:async result=>{
    await writeFile(join(folder,'inspection.json'),JSON.stringify({rootId:result.rootId,rootName:result.rootName,childId:result.childId,
      rootUrl:`https://drive.google.com/drive/folders/${result.rootId}`,cleanupSignal:signal},null,2));
    console.log('Real folders verified. Visual inspection ready; cleanup in at most 180 seconds, or when cleanup.signal is created.');
    const deadline=Date.now()+180_000;
    while(Date.now()<deadline) {if(await readFile(signal,'utf8').then(()=>true,()=>false))break;await new Promise(resolve=>setTimeout(resolve,500));}
  }});
  await writeFile(join(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  if(!result.success)process.exitCode=1;
}catch(error){console.error(safeDriveError(error).message);process.exitCode=1;}
finally{await pool.end();}
