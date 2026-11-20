import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { approvalRequests, authorDocuments, notificaciones, projectDriveFolders, projectDriveWorkspaces, proyectos, reunionesExtraccion, servicios, workItems } from '../server/db/schema/index.js';
import { buildApp } from '../server/app.js';
import { createSession } from '../server/helpers/session.js';
import { editorialInterventions } from '../server/helpers/editorialChief.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { completarPreparacionDePrueba, crearAutor, crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import type { StorageItem } from '../server/modules/integrations/google-drive/provider.js';
const drive=vi.hoisted(()=>({items:new Map<string,any>(),bytes:new Map<string,Buffer>(),uploads:vi.fn(),pin:vi.fn()}));
vi.mock('../server/modules/integrations/google-drive/corporate.js',()=>({withCorporateDrive:async(work:Function)=>{
  const {db}=await import('../server/db/client.js'),{externalIntegrations}=await import('../server/db/schema/index.js');
  const [integration]=await db.select().from(externalIntegrations);
  const storage={
    listFolders:async({parentFolderId}:{parentFolderId:string})=>[...drive.items.values()].filter(f=>f.mimeType==='application/vnd.google-apps.folder'&&f.parents.includes(parentFolderId)),
    createFolder:async(input:any)=>{const f={providerFileId:randomUUID(),name:input.name,mimeType:'application/vnd.google-apps.folder',parents:[input.parentFolderId],appProperties:input.appProperties??{},webViewLink:null};drive.items.set(f.providerFileId,f);return f;},
    uploadFile:async(input:any)=>{drive.uploads(input);const f={providerFileId:randomUUID(),name:input.name,mimeType:input.mimeType,parents:[input.parentFolderId],appProperties:{},webViewLink:null};drive.items.set(f.providerFileId,f);drive.bytes.set(f.providerFileId,input.content);return f;},
    pinAuthorRevision:async(id:string)=>{drive.pin(id);return {revisionId:id+'-fixed-revision',mimeType:drive.items.get(id)?.mimeType??'application/pdf'};},
    readAuthorRevision:async(id:string)=>drive.bytes.get(id)??Buffer.from('%PDF-1.4 test'),
  };
  return work({integration,storage});
}}));
const file={name:'capitulo.pdf',contentBase64:Buffer.from('%PDF-1.4\nDocumento de prueba').toString('base64')};
beforeEach(async()=>{await limpiarBaseDeDatos();drive.items.clear();drive.bytes.clear();vi.clearAllMocks();});
async function fixture(chapterCount=1){
  const editor=await crearUsuario('editor'),specialist=await crearUsuario('especialista');
  const p=await crearProyectoDePrueba({especialistaId:specialist.id});
  await db.update(proyectos).set({editorId:editor.id}).where(eq(proyectos.id,p.id));
  await db.update(servicios).set({codigo:'EF'}).where(eq(servicios.id,p.servicioId));
  const author=await crearUsuario('autor',p.autorId),otherAuthor=await crearAutor(),outsider=await crearUsuario('autor',otherAuthor.id);
  await completarPreparacionDePrueba(p.id);
  if(chapterCount>1)await db.insert(reunionesExtraccion).values(Array.from({length:chapterCount-1},(_,i)=>({proyectoId:p.id,numero:i+2,fechaHora:new Date('2026-10-01'),realizada:true,videoUrl:'https://example.test/video',notasGeminiUrl:'https://example.test/notas'})));
  const [workspace]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,p.id));
  await db.insert(projectDriveFolders).values({workspaceId:workspace!.id,key:'EDITING',driveFolderId:'editing-root',displayName:'Edición',templatePath:'/Edición',status:'READY'});
  drive.items.set('editing-root',{providerFileId:'editing-root',name:'Edición',mimeType:'application/vnd.google-apps.folder',parents:[],appProperties:{}} satisfies Omit<StorageItem,'webViewLink'>);
  const app=buildApp();await app.ready();
  const cookies={editor:'panhouse_sid='+await createSession(editor.id),author:'panhouse_sid='+await createSession(author.id),outsider:'panhouse_sid='+await createSession(outsider.id),specialist:'panhouse_sid='+await createSession(specialist.id)};
  const call=(method:'GET'|'POST',url:string,role:keyof typeof cookies='editor',payload?:unknown)=>app.inject({method,url,headers:{cookie:cookies[role]},...(payload?{payload:payload as object}:{})});
  const send=(input:object)=>call('POST',`/api/editores/proyectos/${p.id}/revisiones`,'editor',{kind:'chapter',chapterNumber:1,expectedVersion:0,requestKey:randomUUID(),file,...input});
  const decide=(id:string,input:object={decision:'approved'})=>call('POST',`/api/autor/approvals/${id}/editorial-decision`,'author',input);
  const guide=async()=>{const r=await call('GET',`/api/editores/proyectos/${p.id}/guia`);expect(r.statusCode,r.body).toBe(200);return r.json();};
  const approveChapter=async(number=1)=>{const r=await send({chapterNumber:number});expect(r.statusCode,r.body).toBe(200);const d=await decide(r.json().id);expect(d.statusCode,d.body).toBe(200);return r.json().id as string;};
  return {app,p,editor,author,specialist,call,send,decide,guide,approveChapter};
}
describe('Guía de edición: capítulos, tripa y títulos',()=>{
  it('guarda una versión exacta por capítulo y la envía al dashboard del Autor',async()=>{
    const f=await fixture();try{
      const r=await f.send({});expect(r.statusCode,r.body).toBe(200);
      const g=await f.guide();expect(g.chapters[0].latest.status).toBe('pending');
      expect(drive.uploads.mock.calls[0]![0].name).toBe('Capítulo 1 v1.pdf');
      const chapter=drive.items.get(drive.uploads.mock.calls[0]![0].parentFolderId);
      expect(chapter.name).toBe('Capítulo 1');expect(drive.items.get(chapter.parents[0]).name).toBe('Caps para corregir');expect(drive.items.get(chapter.parents[0]).parents).toEqual(['editing-root']);
      expect(drive.pin).toHaveBeenCalledTimes(1);
      const a=await f.call('GET','/api/autor/approvals','author');expect(a.json().approvals[0]).toMatchObject({id:r.json().id,status:'pending',editorialReview:{kind:'chapter',version:1},documents:[{title:'Capítulo 1 v1.pdf'}]});
      const interventions=await editorialInterventions(undefined,f.p.id);expect(interventions.find(i=>i.chapter===1)?.state).toBe('Esperando autor');
      const download=await f.call('GET',g.chapters[0].latest.file.url);expect(download.statusCode,download.body).toBe(200);expect(download.headers['content-disposition']).toContain('attachment');
    }finally{await f.app.close();}
  });
  it('repite el ciclo v1, v2, v3 con archivos de feedback, historial y avisos al Editor',async()=>{
    const f=await fixture();try{
      const first=await f.send({});let id=first.json().id;
      for(let version=1;version<=2;version++){
        const feedback=await f.decide(id,{decision:'changes_requested',file});expect(feedback.statusCode,feedback.body).toBe(200);
        const g=await f.guide(),latest=g.chapters[0].latest;
        expect(latest.response.feedbackFile.url).toContain('/feedback');expect(latest.status).toBe('changes_requested');
        const upload=drive.uploads.mock.calls.at(-1)![0],chapter=drive.items.get(upload.parentFolderId);expect(drive.items.get(chapter.parents[0]).name).toBe('Caps con feedback');
        expect((await editorialInterventions(undefined,f.p.id)).find(i=>i.chapter===1)?.state).toBe('Requiere ajustes');
        const next=await f.send({expectedVersion:version});expect(next.statusCode,next.body).toBe(200);id=next.json().id;
      }
      const a=await f.call('GET','/api/autor/approvals/'+id,'author');expect(a.json().history).toHaveLength(2);
      expect((await f.guide()).chapters[0].history.map((v:any)=>v.metadata.version)).toEqual([3,2,1]);
      expect((await f.decide(id)).statusCode).toBe(200);expect((await f.guide()).currentStep).toBe('manuscript');
      const notices=await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,f.editor.id));expect(notices).toHaveLength(3);expect(notices.every(n=>n.targetPath?.includes('guideProject='))).toBe(true);
      const firstDoc=(await db.select().from(authorDocuments))[0]!;await expect(db.update(authorDocuments).set({revisionId:'overwrite'}).where(eq(authorDocuments.id,firstDoc.id))).rejects.toThrow('immutable');
    }finally{await f.app.close();}
  });
  it('exige todos los capítulos aprobados antes de entregar la tripa',async()=>{
    const f=await fixture(2);try{
      await f.approveChapter(1);
      const blocked=await f.send({kind:'manuscript',chapterNumber:undefined,proposedTitles:['Primer título'],chaptersConfirmed:true});expect(blocked.statusCode,blocked.body).toBe(409);
      await f.approveChapter(2);expect((await f.guide()).currentStep).toBe('manuscript');
      const r=await f.send({kind:'manuscript',chapterNumber:undefined,proposedTitles:['Primer título','Otra propuesta'],chaptersConfirmed:true});expect(r.statusCode,r.body).toBe(200);
      const g=await f.guide();expect(g.manuscript.status).toBe('pending');expect(g.titles).toBeNull();
      expect((await f.send({chapterNumber:3})).statusCode).toBe(409);
    }finally{await f.app.close();}
  });
  it('tripa con feedback vuelve como v2; después permite rechazar títulos sin comentario y elegir nuevos',async()=>{
    const f=await fixture();try{
      await f.approveChapter();
      const first=await f.send({kind:'manuscript',chapterNumber:undefined,proposedTitles:['La memoria','El camino'],chaptersConfirmed:true});expect(first.statusCode,first.body).toBe(200);
      expect((await f.decide(first.json().id,{decision:'changes_requested',file,feedback:'Unificar el cierre'})).statusCode).toBe(200);
      const second=await f.send({kind:'manuscript',chapterNumber:undefined,expectedVersion:1,proposedTitles:['La memoria','El camino'],chaptersConfirmed:true});expect(second.statusCode,second.body).toBe(200);
      expect((await f.decide(second.json().id)).statusCode).toBe(200);
      let g=await f.guide();expect(g.currentStep).toBe('titles');expect(g.titles.metadata.proposedTitles).toEqual(['La memoria','El camino']);
      const bad=await f.decide(g.titles.id,{decision:'approved',selectedTitle:'Título ajeno'});expect(bad.statusCode).toBe(400);
      const rejected=await f.decide(g.titles.id,{decision:'changes_requested'});expect(rejected.statusCode,rejected.body).toBe(200);
      g=await f.guide();expect(g.titles.feedback).toBeNull();
      const newer=await f.send({kind:'titles',chapterNumber:undefined,file:undefined,expectedVersion:1,proposedTitles:['Una vida nueva','Volver a empezar']});expect(newer.statusCode,newer.body).toBe(200);
      const final=await f.decide(newer.json().id,{decision:'approved',selectedTitle:'Una vida nueva'});expect(final.statusCode,final.body).toBe(200);
      g=await f.guide();expect(g.currentStep).toBe('complete');expect(g.selectedTitle).toBe('Una vida nueva');
      const [p]=await db.select().from(proyectos).where(eq(proyectos.id,f.p.id));expect(p!.tituloDefinitivo).toBe('Una vida nueva');
      const [work]=await db.select().from(workItems).where(and(eq(workItems.proyectoId,f.p.id),eq(workItems.tipo,'edicion'),eq(workItems.businessKey,'tripa_completa')));expect(work!.estado).toBe('completado');
    }finally{await f.app.close();}
  });
  it('un doble envío con la misma clave conserva una sola carga y versión',async()=>{
    const f=await fixture();try{
      const requestKey=randomUUID(),results=await Promise.all([f.send({requestKey}),f.send({requestKey})]);
      expect(results.map(r=>r.statusCode)).toEqual([200,200]);expect(results[0]!.json().id).toBe(results[1]!.json().id);expect(drive.uploads).toHaveBeenCalledTimes(1);
      expect((await f.send({})).statusCode).toBe(409);expect(drive.uploads).toHaveBeenCalledTimes(1);
    }finally{await f.app.close();}
  });
  it('solo registra una decisión ante doble clic concurrente y no reescribe una versión aprobada',async()=>{
    const f=await fixture();try{
      const first=await f.send({}),id=first.json().id;
      const results=await Promise.all([f.decide(id),f.decide(id)]);expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);
      expect((await f.send({expectedVersion:1})).statusCode).toBe(409);
      await expect(db.update(approvalRequests).set({feedback:'cambiar decisión'}).where(eq(approvalRequests.id,id))).rejects.toThrow('immutable');
    }finally{await f.app.close();}
  });
  it('restringe guía, descargas, envíos y decisiones a sus responsables',async()=>{
    const f=await fixture();try{
      const first=await f.send({}),g=await f.guide();
      expect((await f.call('GET',`/api/editores/proyectos/${f.p.id}/guia`,'author')).statusCode).toBe(403);
      expect((await f.call('GET',g.chapters[0].latest.file.url,'author')).statusCode).toBe(403);
      expect((await f.call('POST',`/api/autor/approvals/${first.json().id}/editorial-decision`,'outsider',{decision:'approved'})).statusCode).toBe(404);
      expect((await f.call('POST',`/api/autor/approvals/${first.json().id}/editorial-decision`,'editor',{decision:'approved'})).statusCode).toBe(403);
      const p2=await crearProyectoDePrueba();expect((await f.call('GET',`/api/editores/proyectos/${p2.id}/guia`)).statusCode).toBe(404);
      expect((await f.call('GET',`/api/editores/proyectos/${p2.id}/revisiones/${first.json().id}/archivo`)).statusCode).toBe(404);
      expect((await f.call('POST',`/api/autor/approvals/${first.json().id}/decision`,'author',{decision:'changes_requested',feedback:'Sin archivo'})).statusCode).toBe(400);
    }finally{await f.app.close();}
  });
  it('valida archivo, versión esperada y títulos antes de publicar',async()=>{
    const f=await fixture();try{
      for(const input of [{file:undefined},{file:{name:'ejecutable.exe',contentBase64:file.contentBase64}},{file:{name:'falso.pdf',contentBase64:Buffer.from('<html>not a pdf</html>').toString('base64')}},{expectedVersion:4}])expect((await f.send(input)).statusCode).toBeGreaterThanOrEqual(400);
      expect(drive.uploads).not.toHaveBeenCalled();expect(await db.select().from(approvalRequests)).toHaveLength(0);
      const first=await f.send({});expect((await f.decide(first.json().id,{decision:'changes_requested'})).statusCode).toBe(400);
      expect((await f.decide(first.json().id,{decision:'approved',file})).statusCode).toBe(400);
    }finally{await f.app.close();}
  });
  it('espera las entrevistas y bloquea operaciones durante una pausa',async()=>{
    const f=await fixture();try{
      await db.update(reunionesExtraccion).set({notasGeminiUrl:null}).where(eq(reunionesExtraccion.proyectoId,f.p.id));
      expect((await f.guide()).currentStep).toBe('interviews');expect((await f.send({})).statusCode).toBe(409);
      await db.update(reunionesExtraccion).set({notasGeminiUrl:'https://example.test/notas'}).where(eq(reunionesExtraccion.proyectoId,f.p.id));
      const r=await f.send({});await db.update(proyectos).set({estado:'pausado'}).where(eq(proyectos.id,f.p.id));
      expect((await f.guide()).blockedReason).toContain('pausa');expect((await f.decide(r.json().id)).statusCode).toBe(409);
    }finally{await f.app.close();}
  });
});
