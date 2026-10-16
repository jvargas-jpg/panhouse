/** Explicit local account provisioning. Does not reset an existing account. Credentials stay ignored. */
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { users } from '../server/db/schema/index.js';
import { hashPassword } from '../server/helpers/password.js';
import { env } from '../server/config/env.js';
try {
  if(env.NODE_ENV!=='development')throw new Error('This helper is only for the local development database.');
  const email='admin@panhouse.local';
  if(await db.query.users.findFirst({where:eq(users.email,email)}))throw new Error('Account already exists; no credentials were changed.');
  const password=randomBytes(24).toString('base64url');
  await mkdir('secrets',{recursive:true});
  // Exclusive creation prevents accidentally replacing existing local credentials.
  await writeFile('secrets/panhouse-admin.local.json',JSON.stringify({email,password,role:'direccion'},null,2)+'\n',{flag:'wx',mode:0o600});
  const [user]=await db.insert(users).values({email,nombre:'Administrador PanHouse',rol:'direccion',passwordHash:await hashPassword(password)}).returning({id:users.id,email:users.email,rol:users.rol});
  console.log(JSON.stringify({created:user,credentialsFile:'secrets/panhouse-admin.local.json'}));
}catch{console.error('Local administrator was not created. Check for an existing account or credential file; no password has been overwritten.');process.exitCode=1;}
finally{await pool.end();}
