import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {and,eq} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {users} from '../server/db/schema/index.js';
import {createSession} from '../server/helpers/session.js';
import {env} from '../server/config/env.js';
try{
  const url=new URL(env.DATABASE_URL);if(env.NODE_ENV!=='development'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw Error('Local QA development only');
  const path='secrets/creative-leader-qa.local.json';
  const previous=await readFile(path,'utf8').then(JSON.parse,()=>({}));
  const identities=[];
  for(const rol of ['lider_creativo','especialista','rrpp','disenador','jefe_area'] as const){
    const [u]=await db.select({id:users.id,email:users.email,nombre:users.nombre}).from(users).where(and(eq(users.rol,rol),eq(users.activo,true))).orderBy(users.createdAt).limit(1);
    if(!u)throw Error('Existing role required: '+rol);
    identities.push({...u,rol,cookie:await createSession(u.id)});
  }
  await mkdir('secrets',{recursive:true});await writeFile(path,JSON.stringify({...previous,identities},null,2),{mode:0o600});
  console.log(JSON.stringify({roles:identities.map(i=>i.rol),existingUsersOnly:true,passwordsChanged:false}));
}finally{await pool.end();}
