import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Redis} from 'ioredis';
import {Queue} from 'bullmq';
import {pool} from '../../db/client.js';
import {env} from '../../config/env.js';
import type {AdminHealth} from '../../../shared/admin.js';
const QUEUES=['project-drive-workspaces','notificaciones'];
export async function adminHealth():Promise<AdminHealth>{
 const application={status:'responding',uptime:Math.floor(process.uptime())};
 const pgStart=performance.now();let postgres:AdminHealth['postgres']={status:'unavailable',latencyMs:null,total:pool.totalCount,idle:pool.idleCount,waiting:pool.waitingCount};
 try{await pool.query('SELECT 1');postgres={...postgres,status:'connected',latencyMs:Math.round(performance.now()-pgStart)};}catch{/* never expose connection errors */}
 const migrations:AdminHealth['migrations']={applied:0,latest:null,pending:[],status:'unavailable'};
 try{const journal=JSON.parse(await readFile(join(process.cwd(),'server/db/migrations/meta/_journal.json'),'utf8')) as {entries:{when:number;tag:string}[]};
  const {rows:[r]}=await pool.query<{count:number;last:string|null}>('SELECT count(*)::int count,max(created_at)::text last FROM drizzle.__drizzle_migrations');
  migrations.applied=r!.count;const last=Number(r!.last??0);migrations.latest=journal.entries.filter(e=>e.when<=last).at(-1)?.tag??null;migrations.pending=journal.entries.filter(e=>e.when>last).map(e=>e.tag);migrations.status=migrations.pending.length?'pending':'up_to_date';
 }catch{/* honest unavailable signal */}
 let redis:AdminHealth['redis']={status:'unavailable',latencyMs:null};
 let queues:AdminHealth['queues']=QUEUES.map(name=>({name,status:'unavailable',waiting:0,active:0,failed:0,delayed:0,jobs:[]}));
 const connection=new Redis(env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:0,retryStrategy:()=>null,connectTimeout:1200,commandTimeout:1500,enableOfflineQueue:false});
 connection.on('error',()=>{});const instances:Queue[]=[];
 try{const start=performance.now();await connection.connect();await connection.ping();redis={status:'connected',latencyMs:Math.round(performance.now()-start)};
  queues=await Promise.all(QUEUES.map(async name=>{const q=new Queue(name,{connection});instances.push(q);
   try{const [counts,jobs]=await Promise.all([q.getJobCounts('waiting','active','failed','delayed'),q.getJobs(['failed'],0,19)]);
    return {name,status:'observed',waiting:counts.waiting??0,active:counts.active??0,failed:counts.failed??0,delayed:counts.delayed??0,
     jobs:jobs.map(j=>({id:j.id??'',name:j.name,at:j.finishedOn?new Date(j.finishedOn).toISOString():null,attempts:j.attemptsMade,projectId:typeof j.data?.projectId==='string'&&/^[0-9a-f-]{36}$/i.test(j.data.projectId)?j.data.projectId:null}))};
   }catch{return {name,status:'unavailable',waiting:0,active:0,failed:0,delayed:0,jobs:[]};}
  }));
 }catch{/* no Redis health inferred from page availability */}
 finally{await Promise.allSettled(instances.map(q=>q.close()));connection.disconnect();}
 return {checkedAt:new Date().toISOString(),application,postgres,redis,queues,migrations,backups:{status:'not_monitored',message:'No existe un monitor de backups conectado a PanHouse.'}};
}
