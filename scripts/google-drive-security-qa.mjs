/** Report filenames/counts only. Never print candidate secret values or matching source lines. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
const files=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean))];
const local=parse(readFileSync('.env','utf8'));
const secrets=Object.entries(local).filter(([key,value])=>/SECRET|ENCRYPTION_KEY/.test(key)&&value.length>=12&&!/pendiente|example|placeholder|^</i.test(value));
try{const admin=JSON.parse(readFileSync('secrets/panhouse-admin.local.json','utf8'));if(admin.password)secrets.push(['LOCAL_ADMIN_PASSWORD',admin.password]);}catch{/* optional local provision */}
const needles=['client_secret','refresh_token','access_token','private_key'],references=[],findings=[];
for(const file of files){
  if(/\.(png|jpe?g|pdf|docx|xlsx|woff2?)$/i.test(file))continue;
  let text;try{text=readFileSync(file,'utf8');}catch{continue;}
  const counts=Object.fromEntries(needles.map(word=>[word,(text.match(new RegExp(word,'gi'))??[]).length]));
  if(Object.values(counts).some(Boolean))references.push({file,counts});
  for(const [kind,value]of secrets)if(text.includes(value))findings.push({file,kind});
  if(/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/.test(text))findings.push({file,kind:'private-key-material'});
  if(/\bya29\.[A-Za-z0-9_-]{30,}|\b1\/\/[A-Za-z0-9_-]{50,}/.test(text))findings.push({file,kind:'google-token-pattern'});
}
const ignored=execFileSync('git',['check-ignore','.env'],{encoding:'utf8'}).trim()==='.env';
const result={checkedFiles:files.length,localEnvIgnored:ignored,references,findings};
writeFileSync('docs/evidencias/google-drive/security-qa.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({checkedFiles:files.length,localEnvIgnored:ignored,referenceFiles:references.length,findings}));
if(!ignored||findings.length)process.exitCode=1;
