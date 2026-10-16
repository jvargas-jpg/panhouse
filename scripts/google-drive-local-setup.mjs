// Prepara únicamente los valores locales ausentes; nunca imprime secretos.
import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
const path=new URL('../.env',import.meta.url),text=await readFile(path,'utf8'),current=parse(text),add=[];
for(const[key,value]of Object.entries({GOOGLE_DRIVE_SCOPE:'https://www.googleapis.com/auth/drive.file',GOOGLE_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),APP_FRONTEND_URL:'http://localhost:5173'})) {
  if(!current[key])add.push([key,value]);
}
let next=text;
for(const[key,value]of add){const line=new RegExp('^'+key+'=.*$','m');if(line.test(next))next=next.replace(line,key+'='+value);else next+='\n'+key+'='+value;}
if(add.length)await writeFile(path,next.endsWith('\n')?next:next+'\n');
const configured=parse(next);
console.log(JSON.stringify({added:add.map(([key])=>key),clientIdPresent:!!configured.GOOGLE_CLIENT_ID,clientSecretPresent:!!configured.GOOGLE_CLIENT_SECRET,registeredCallbackMatches:configured.GOOGLE_REDIRECT_URI==='http://localhost:3000/api/auth/google/callback'}));
