// Only scripts/project-guide-qa-server.ts, on its disposable local database.
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3017';
const context=await (await fetch(origin+'/api/__qa/context')).json();
const sessions={};
for(const role of ['especialista','jefatura']) {
 const result=await fetch(origin+'/api/__qa/session/'+role,{redirect:'manual'});
 assert.equal(result.status,302);sessions[role]=result.headers.get('set-cookie').split(';')[0];
}
async function get(role,path) {
 const r=await fetch(origin+'/api'+path,{headers:{cookie:sessions[role]}});
 assert.equal(r.status,200,await r.clone().text());return r.json();
}
for(const project of [context.initial,context.waiting]) {
 const a=(await get('especialista','/proyectos/'+project+'/command-center')).guide;
 const b=(await get('jefatura','/proyectos/'+project+'/command-center')).guide;
 assert.equal(a.currentPath,b.currentPath);assert.equal(a.position,b.position);
 assert.deepEqual(a.paths.map(p=>[p.id,p.state,p.waitingFor,p.requirements]),b.paths.map(p=>[p.id,p.state,p.waitingFor,p.requirements]));
 const portfolio=await get('especialista','/proyectos/guia-portafolio');
 assert.equal(portfolio.items.find(p=>p.id===project).mainProcess?.currentStep,a.position);
 assert(b.paths.every(p=>!p.canOperate&&!p.canContinue));
}
const waiting=(await get('especialista','/proyectos/'+context.waiting+'/command-center')).guide.paths.find(p=>p.id==='edicion');
assert.equal(waiting.waitingFor,'Jefatura de Edición');
assert.equal(waiting.canContinue,false);
const home=await get('especialista','/proyectos/guia-inicio');
assert(home.newAssignments.some(p=>p.id===context.initial));
assert(home.waiting.some(w=>w.project.id===context.waiting&&w.process.id==='edicion'));
assert(!home.actions.some(a=>a.project.id===context.waiting&&a.process.id==='edicion'));
assert(home.actions.some(a=>a.project.id===context.waiting&&a.process.id==='correccion'));
const chiefHome=await get('jefatura','/proyectos/guia-inicio');
assert(chiefHome.interventions.some(i=>i.projectId===context.unassigned&&i.kind==='assignment'));
const unassigned=(await get('jefatura','/proyectos/'+context.unassigned+'/command-center')).guide;
assert.equal(unassigned.currentPath,null);assert.equal(unassigned.availableProcesses.length,0);
console.log(JSON.stringify({result:'PASS',projects:3,roles:2,sharedState:true,portfolioMatchesGuide:true,editorWait:true,distinctHomeProjection:true,newAssignments:true,chiefAssignment:true,transport:'real HTTP and PostgreSQL',externalServices:'not contacted',visualQA:'not performed'},null,2));
