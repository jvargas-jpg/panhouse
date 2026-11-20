import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EditorGuidedProject } from './EditorGuidedProject';
import { AuthorEditorialApproval } from '../portalAutor/AuthorPortalViews';
import type { EditorialReviewGuide, EditorialReviewVersion } from '../../../shared/editorialReview';
import type { Approval } from '../portalAutor/authorPortalApi';
vi.stubGlobal('React',React);
const review:EditorialReviewVersion={id:'review',status:'changes_requested',metadata:{kind:'chapter',version:2,chapterNumber:1,requestKey:'key'},response:{feedbackFile:{id:'feedback',name:'Capítulo 1 v2 con feedback.pdf',url:'/feedback',mimeType:'application/pdf',revisionId:'revision'}},feedback:'Ajustar el final',requestedAt:'2026-11-20T12:00:00Z',decidedAt:'2026-11-20T13:00:00Z',file:{name:'Capítulo 1 v2.pdf',url:'/version'}};
const guide:EditorialReviewGuide={projectId:'project',title:'Nuestro libro',authors:'Autora',serviceCode:'EF',currentStep:'chapters',blockedReason:null,authorHasAccount:true,chapters:[{number:1,latest:review,history:[review]}],manuscript:null,titles:null,history:[review],selectedTitle:null};
function render(node:React.ReactElement){const client=new QueryClient();try{return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>);}finally{client.clear();}}
describe('Guía del Editor y decisiones del Autor',()=>{
 it('muestra el feedback descargable y permite subir v3 conservando el historial',()=>{
   const html=render(<EditorGuidedProject guide={guide} onBack={()=>{}} onRefetch={async()=>{}}/>);
   for(const text of ['Guía de edición del proyecto','Descargar capítulo 1 con feedback','/feedback','v3','Historial de versiones','Guardar v3 y enviar al Autor','Ajustar el final'])expect(html).toContain(text);
   expect(html).not.toContain('eo-detail');
 });
 it('la tripa incluye carga documental, lista editable de títulos y confirmación de capítulos',()=>{
   const html=render(<EditorGuidedProject guide={{...guide,currentStep:'manuscript',chapters:[{number:1,latest:{...review,status:'approved'},history:[review]}]}} onBack={()=>{}} onRefetch={async()=>{}}/>);
   for(const text of ['Tripa completa y posibles títulos','Documento Word o PDF','Posibles títulos','Propuesta 1','Añadir otro título','Confirmo que esta tripa'])expect(html).toContain(text);
 });
 it('el Autor elige un título o puede pedir nuevas propuestas sin comentario obligatorio',()=>{
   const a:Approval={id:'title',projectId:'project',projectTitle:'Nuestro libro',type:'titulos_propuestos',title:'Títulos propuestos · v1',instructions:'Elige uno',status:'pending',requestedAt:'2026-11-20T12:00:00Z',dueAt:null,feedback:null,decidedAt:null,previousId:null,sentBy:'Editor',external:false,overdueDays:0,documents:[],editorialReview:{kind:'titles',version:1,requestKey:'key',proposedTitles:['Una vida','Otro camino']}};
   const html=render(<AuthorEditorialApproval approval={a}/>);
   for(const text of ['Una vida','Otro camino','type="radio"','No aprobar','Comentarios (opcionales)','Aprobar título elegido'])expect(html).toContain(text);
   expect(html).not.toContain('obligatorios');
 });
});
