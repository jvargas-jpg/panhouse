import 'dotenv/config';
import {Pool} from 'pg';
import {spawn} from 'node:child_process';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
const root=resolve('.'),output=resolve('docs/evidencias/editor');await mkdir(output,{recursive:true});
const base=new URL(process.env.DATABASE_URL);if(!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Regression shards are restricted to local PostgreSQL');
const admin=new Pool({connectionString:base.toString()});const jobs=[];
for(let shard=1;shard<=4;shard++){
 const name='panhouse_editor_regression_20261026_'+shard+'_test';
 if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await admin.query('CREATE DATABASE "'+name+'"');
 const target=new URL(base);target.pathname='/'+name.replace(/_test$/,'');
 jobs.push({shard,target:target.toString(),file:join(output,'regression-shard-'+shard+'.json')});
}
await admin.end();
await Promise.all(jobs.map(job=>new Promise((resolveJob,reject)=>{
 const child=spawn(process.execPath,[join(root,'node_modules/vitest/vitest.mjs'),'run','--shard='+job.shard+'/4','--maxWorkers=1','--minWorkers=1','--testTimeout=60000','--hookTimeout=60000','--reporter=json','--outputFile='+job.file],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'test',DATABASE_URL:job.target},stdio:['ignore','inherit','inherit']});
 console.log('Started regression shard '+job.shard+'/4 (isolated database)');
 child.on('error',reject);child.on('exit',async code=>{console.log('Finished regression shard '+job.shard+'/4, exit '+code);resolveJob(code);});
})));
const reports=await Promise.all(jobs.map(j=>readFile(j.file,'utf8').then(JSON.parse)));
const testResults=reports.flatMap(r=>r.testResults),normalize=p=>p.replaceAll('\\','/').toLowerCase();
const names=testResults.map(t=>normalize(relative(root,t.name)));const covered=new Set(names);
async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.filter(e=>!['node_modules','.git','dist'].includes(e.name)).map(async e=>e.isDirectory()?files(join(dir,e.name)):/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name)?[join(dir,e.name)]:[]))).flat();}
const expected=(await files(root)).map(f=>normalize(relative(root,f)));
const missing=expected.filter(f=>!covered.has(f)),duplicates=names.filter((n,i)=>names.indexOf(n)!==i);
const sum=key=>reports.reduce((n,r)=>n+(r[key]??0),0);
const merged={numTotalTestSuites:sum('numTotalTestSuites'),numPassedTestSuites:sum('numPassedTestSuites'),numFailedTestSuites:sum('numFailedTestSuites'),numPendingTestSuites:sum('numPendingTestSuites'),numTotalTests:sum('numTotalTests'),numPassedTests:sum('numPassedTests'),numFailedTests:sum('numFailedTests'),numPendingTests:sum('numPendingTests'),startTime:Math.min(...reports.map(r=>r.startTime)),success:reports.every(r=>r.success)&&!missing.length&&!duplicates.length,testResults,
 coverage:{expectedFiles:expected.length,coveredFiles:covered.size,missing,duplicates},execution:{shards:4,isolatedDatabases:true,testTimeout:60000,hookTimeout:60000}};
await writeFile(join(output,'full-regression.json'),JSON.stringify(merged,null,2));
console.log(JSON.stringify({success:merged.success,files:covered.size,tests:merged.numTotalTests,passed:merged.numPassedTests,failed:merged.numFailedTests,missing,duplicates}));
if(!merged.success)process.exitCode=1;
