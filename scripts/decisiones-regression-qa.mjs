import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Three independent databases, one disposable RAM-backed QA PostgreSQL.
const source = new URL(process.env.DATABASE_URL);
if (!['localhost','127.0.0.1'].includes(source.hostname)) throw Error('Local QA only');
source.port = '5434';
const dir=process.env.PANHOUSE_QA_OUTPUT ?? 'docs/evidencias/decisiones-jefatura';
await mkdir(dir,{recursive:true});
const started=Date.now();
const runs=await Promise.all([1,2,3].map(shard=>new Promise((resolve,reject)=>{
  const filename=`${dir}/tests-shard-${shard}.json`;
  const log=createWriteStream(join(tmpdir(),`panhouse-decisiones-shard-${shard}.log`));
  const child=spawn(process.execPath,['--import','tsx','scripts/decisiones-test-qa.ts',`--shard=${shard}/3`,'--hookTimeout=180000','--testTimeout=180000','--reporter=verbose','--reporter=json',`--outputFile=${filename}`],{env:{...process.env,DATABASE_URL:source.toString(),PANHOUSE_QA_SHARD:String(shard)},stdio:['ignore','pipe','pipe']});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  child.on('error',reject);child.on('exit',code=>{log.end();console.log(`QA shard ${shard} exit ${code}`);resolve({shard,code,filename});});
})));
const reports=await Promise.all(runs.map(async run=>JSON.parse(await readFile(run.filename,'utf8'))));
const files=reports.flatMap(r=>r.testResults);
if(new Set(files.map(f=>f.name)).size!==files.length)throw Error('Duplicate test files between shards');
const summary={shards:runs.map(r=>({shard:r.shard,exitCode:r.code})),testFiles:files.length,passedFiles:files.filter(f=>f.status==='passed').length,failedFiles:files.filter(f=>f.status==='failed').length,tests:reports.reduce((n,r)=>n+r.numTotalTests,0),passed:reports.reduce((n,r)=>n+r.numPassedTests,0),failed:reports.reduce((n,r)=>n+r.numFailedTests,0),skipped:reports.reduce((n,r)=>n+r.numPendingTests,0),durationSeconds:(Date.now()-started)/1000};
await writeFile(`${dir}/tests-completos.json`,JSON.stringify({...summary,testResults:files},null,2));
console.log(JSON.stringify(summary));
process.exitCode=runs.every(r=>r.code===0)&&summary.failed===0&&summary.failedFiles===0?0:1;
