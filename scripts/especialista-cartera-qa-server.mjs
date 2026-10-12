import 'dotenv/config';
import { spawn } from 'node:child_process';
import { openSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const cwd=process.cwd(), folder=join(tmpdir(),'panhouse-cartera-qa');
if(!existsSync(join(folder,'private.json')))throw Error('Prepara primero las fixtures aisladas');
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/panhouse')throw Error('Solo entorno local');
url.pathname='/panhouse_cartera_qa_20261012';
if(process.argv.includes('--backend')) {
  process.env.DATABASE_URL=url.toString();process.env.PORT='3009';
  await import('../dist/server/server.js');
} else {
function start(args,dir,env,name){const p=spawn(process.execPath,args,{cwd:dir,env:{...process.env,...env},windowsHide:true,detached:true,stdio:['ignore',openSync(join(folder,name+'.out.log'),'w'),openSync(join(folder,name+'.err.log'),'w')]});p.unref();return p.pid;}
const BackendPID=start([resolve('scripts/especialista-cartera-qa-server.mjs'),'--backend'],cwd,{},'backend');
const FrontendPID=start([resolve('frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5179','--strictPort'],join(cwd,'frontend'),{VITE_API_PROXY_TARGET:'http://127.0.0.1:3009'},'frontend');
writeFileSync(join(folder,'processes.json'),JSON.stringify({BackendPID,FrontendPID}));
console.log('Servicios QA locales iniciados: API 3009, frontend 5179');
}
