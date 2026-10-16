import 'dotenv/config';
import { spawn } from 'node:child_process';
import { openSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const folder=join(tmpdir(),'panhouse-monthly-goals-qa'),fixture=JSON.parse(readFileSync(join(folder,'private.json'),'utf8'));
const url=new URL(process.env.DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)||fixture.databaseName!=='panhouse_goals_qa_20261016')throw new Error('Solo QA local aislado');
url.pathname='/'+fixture.databaseName;
function start(args,cwd,env,name) {
  const p=spawn(process.execPath,args,{cwd,env:{...process.env,...env},windowsHide:true,detached:true,stdio:['ignore',openSync(join(folder,name+'.out.log'),'w'),openSync(join(folder,name+'.err.log'),'w')]});p.unref();return p.pid;
}
const backend=start(['--import','tsx','server/server.ts'],process.cwd(),{DATABASE_URL:url.toString(),PORT:'3014'},'backend');
const frontend=start([resolve('frontend/node_modules/vite/bin/vite.js'),'--host','localhost','--port','5184','--strictPort'],resolve('frontend'),{VITE_API_PROXY_TARGET:'http://localhost:3014'},'frontend');
writeFileSync(join(folder,'processes.json'),JSON.stringify({backend,frontend}));console.log('QA iniciado: http://localhost:5184 (API aislada 3014).');
