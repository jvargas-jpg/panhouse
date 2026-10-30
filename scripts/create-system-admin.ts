/** Explicit local bootstrap. Existing Dirección and Admin accounts are never promoted or reset. */
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {eq} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {users} from '../server/db/schema/index.js';
import {hashPassword} from '../server/helpers/password.js';
import {env} from '../server/config/env.js';
try{
 if(env.NODE_ENV!=='development')throw new Error('Local bootstrap only');
 const email='system-admin@panhouse.local';
 if(await db.query.users.findFirst({where:eq(users.email,email)}))throw new Error('Existing account');
 const password=randomBytes(24).toString('base64url');await mkdir('secrets',{recursive:true});
 await writeFile('secrets/panhouse-system-admin.local.json',JSON.stringify({email,password,role:'admin'},null,2)+'\n',{flag:'wx',mode:0o600});
 const [u]=await db.insert(users).values({email,nombre:'Administración PanHouse',rol:'admin',passwordHash:await hashPassword(password)}).returning({id:users.id,email:users.email,role:users.rol});
 console.log(JSON.stringify({created:u,credentialsFile:'secrets/panhouse-system-admin.local.json'}));
}catch{console.error('No se creó la cuenta. No se cambió ninguna contraseña ni se promovieron cuentas existentes.');process.exitCode=1;}
finally{await pool.end();}
