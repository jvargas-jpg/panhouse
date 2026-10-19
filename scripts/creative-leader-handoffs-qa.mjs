// Read-only verification after creative-leader-browser-qa.mjs --functional.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const f=JSON.parse(await readFile('secrets/creative-leader-qa.local.json','utf8'));
const c=kind=>f.cases.find(c=>c.kind===kind);
async function get(path,rol){const r=await fetch('http://localhost:5173/api'+path,{headers:{cookie:'panhouse_sid='+f.identities.find(i=>i.rol===rol).cookie}});assert.equal(r.status,200);return r.json();}
const brief=(await get('/proyectos/'+c('brief').projectId+'/direccion-creativa','especialista')).direcciones.find(d=>d.id===c('brief').processId);
assert.equal(brief.briefEnlace,'https://example.test/qa/brief/browser-delivery');assert(brief.fechaBriefEnviadoEspecialista);assert(!brief.fechaBriefAprobadoAutor);
const checkpoint=(await get('/direccion-creativa/pendientes-rrpp','rrpp')).propuestas;
assert.equal(checkpoint.filter(p=>p.direccionCreativaId===c('concepts').processId).length,2);
assert(checkpoint.some(p=>p.direccionCreativaId===c('rrpp_feedback').processId));
const author=(await get('/direccion-creativa/'+c('author_feedback').processId+'/propuestas','especialista')).propuestas.find(p=>p.id===c('author_feedback').conceptIds[0]);
assert(author.fechaAprobadaRrpp);assert.equal(author.fechaEnviadaAutor,null);assert.equal(author.estado,'Ajustada para autor');
const resources=(await get('/proyectos/'+c('resources').projectId+'/direccion-creativa','especialista')).direcciones.find(d=>d.id===c('resources').processId);
assert.equal(resources.estado,'completado');assert(resources.recursoImagenUrl&&resources.recursoConceptoPdfUrl);
const cover=(await get('/proyectos/'+c('cover').projectId+'/direccion-creativa','especialista')).direcciones.find(d=>d.id===c('cover').reviewId);
assert.equal(cover.resultadoFinal,'aprobado');assert.equal(cover.estado,'completado');
await writeFile('docs/evidencias/lider-creativo/handoffs-api.json',JSON.stringify({at:new Date().toISOString(),specialistReceivesBrief:true,rrppReceivesTwoConcepts:true,rrppReceivesAdjustment:true,specialistReceivesAuthorAdjustment:true,resourcesCompleteWorkItem:true,coverReviewComplete:true},null,2));
console.log('Creative downstream handoffs QA passed');
