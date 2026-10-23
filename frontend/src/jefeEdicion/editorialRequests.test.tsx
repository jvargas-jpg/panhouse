import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorialRequests} from './EditorialRequests';
import type {EditorialRequestDetail,EditorialRequestList,EditorialRequestSummary} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);

const pendingRow:EditorialRequestSummary={id:'req-qa',projectId:'project-qa',code:'QAS01',title:'Proyecto de verificación',authors:'Autora de prueba',coverUrl:null,service:'Escritura fantasma',serviceId:'service-qa',requester:'Especialista QA',requesterId:'specialist-qa',requesterRole:'especialista',status:'pendiente',requestedAt:'2026-10-10T12:00:00Z',resolvedAt:null,resolvedBy:null,resultEditorId:null,resultEditor:null,resultWorkItemId:null};
const resolvedRow:EditorialRequestSummary={...pendingRow,id:'req-done',status:'resuelta',resolvedAt:'2026-10-15T12:00:00Z',resolvedBy:'Jefe de Edición QA',resultEditorId:'editor-qa',resultEditor:'Editor de verificación',resultWorkItemId:'req-done'};
const list:EditorialRequestList={items:[pendingRow],total:1,page:1,pages:1,counts:{pending:1,resolved:4,all:5},options:{services:[{id:'service-qa',name:'Escritura fantasma'}],requesters:[{id:'specialist-qa',name:'Especialista QA'}]}};
const detailPending:EditorialRequestDetail={summary:pendingRow,context:{editorialState:'Pendiente',currentEditor:null,specialist:'Especialista QA',deadline:null,waitingOn:null,blocker:null},history:[{id:'ev-1',label:'Editor solicitado por Especialista',actor:'Especialista QA',at:'2026-10-10T12:00:00Z'}]};
const detailResolved:EditorialRequestDetail={summary:resolvedRow,context:null,history:[{id:'ev-1',label:'Editor solicitado por Especialista',actor:'Especialista QA',at:'2026-10-10T12:00:00Z'},{id:'ev-2',label:'Editor asignado',actor:'Jefe de Edición QA',at:'2026-10-15T12:00:00Z'}]};

function render(data:EditorialRequestList|undefined,url='/?vista=solicitudes-edicion',selectedDetail:EditorialRequestDetail|undefined=undefined,error?:'list'|'detail'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 const urlParams=new URL(url,'http://local').searchParams;
 const queryParams=new URLSearchParams({tab:urlParams.get('tab')??'pending',page:urlParams.get('page')??'1',pageSize:urlParams.get('pageSize')??'10',sort:urlParams.get('sort')??((urlParams.get('tab')??'pending')==='resolved'?'newest':'oldest')});
 for(const key of ['search','service','requester','from','to'])if(urlParams.get(key))queryParams.set(key,urlParams.get(key)!);
 const listKey=['editorial-chief','requests',queryParams.toString()];
 const requestId=urlParams.get('selectedRequest');
 const detailKey=['editorial-chief','request-detail',requestId];
 if(data)client.setQueryData(listKey,data);
 if(selectedDetail)client.setQueryData(detailKey,selectedDetail);
 if(error){const key=error==='list'?listKey:detailKey;client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',error:new Error('QA fallida'),fetchStatus:'idle'});}
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><EditorialRequests onOpen={()=>{}}/></StaticRouter></QueryClientProvider>);
 client.clear();return html;
}

describe('Solicitudes · página',()=>{
 it('solo existe un tipo real de solicitud: no hay columna ni filtro de prioridad, ni tipos inventados (reasignación/apoyo/escalación)',()=>{
  const html=render(list);
  expect(html).toContain('Asignación de Editor');
  expect(html).not.toMatch(/Prioridad|Reasignación|Apoyo por carga|Escalaci[oó]n/);
 });
 it('KPIs vienen del backend (counts), no se recalculan en React',()=>{
  const html=render(list);
  expect(html).toContain('>1<');
  expect(html).toContain('>4<');
 });
 it('tab por defecto es Pendientes',()=>{
  const html=render(list);
  expect(html).toMatch(/aria-selected="true">Pendientes/);
 });
 it('fila pendiente ofrece "Revisar", fila resuelta es de solo lectura ("Ver detalle")',()=>{
  const htmlPending=render(list);
  expect(htmlPending).toContain('Revisar');
  const htmlResolved=render({...list,items:[resolvedRow],counts:{...list.counts,pending:0}},'/?vista=solicitudes-edicion&tab=resolved');
  expect(htmlResolved).toContain('Ver detalle');
  expect(htmlResolved).not.toContain('>Revisar<');
 });
 it('seleccionar una solicitud pendiente abre el detalle con el CTA "Revisar asignación" que reutiliza el drawer global, sin selector propio de Editor',()=>{
  const html=render(list,'/?vista=solicitudes-edicion&selectedRequest=req-qa',detailPending);
  expect(html).toContain('Revisar asignación');
  expect(html).not.toMatch(/ec-editor-choice|Seleccionar Editor/);
 });
 it('detalle de una solicitud resuelta muestra el resultado (Editor asignado, quién resolvió) en modo lectura',()=>{
  const html=render({...list,items:[resolvedRow]},'/?vista=solicitudes-edicion&tab=resolved&selectedRequest=req-done',detailResolved);
  expect(html).toContain('Editor de verificación');
  expect(html).toContain('Jefe de Edición QA');
  expect(html).not.toContain('Revisar asignación');
 });
 it('detalle resuelto expone la pestaña Contexto (aun si su contexto quedó sin datos porque el proyecto ya avanzó)',()=>{
  const html=render({...list,items:[resolvedRow]},'/?vista=solicitudes-edicion&tab=resolved&selectedRequest=req-done',detailResolved);
  expect(html).toContain('Contexto');
  expect(() => render({...list,items:[resolvedRow]},'/?vista=solicitudes-edicion&tab=resolved&selectedRequest=req-done',detailResolved)).not.toThrow();
 });
 it('vacío de pendientes es un buen estado, no un error',()=>{
  const html=render({...list,items:[],total:0,counts:{...list.counts,pending:0}});
  expect(html).toContain('No tienes solicitudes pendientes.');
 });
 it('error de lista y de detalle son independientes',()=>{
  expect(render(undefined,'/?vista=solicitudes-edicion',undefined,'list')).toContain('Reintentar');
  const html=render(list,'/?vista=solicitudes-edicion&selectedRequest=req-qa',undefined,'detail');
  expect(html).toContain('No se pudo cargar la solicitud');
 });
});
