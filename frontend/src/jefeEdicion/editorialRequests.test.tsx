import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorialRequests,requestDate} from './EditorialRequests';
import type {EditorialRequestDetail,EditorialRequestList,EditorialRequestSummary} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);

const pendingRow:EditorialRequestSummary={projectActive:true,workItemId:'req-qa',businessKey:'default',requestType:'ASSIGN_EDITOR',interventionLabel:'Inicio de edición',description:'Asignar Editor para Inicio de edición.',volume:null,requestedDate:null,notes:null,returnReason:null,actionable:true,assignmentReady:true,version:1,resultAssignmentId:null,id:'req-qa',projectId:'project-qa',code:'QAS01',title:'Proyecto de verificación',authors:'Autora de prueba',coverUrl:null,service:'Escritura fantasma',serviceId:'service-qa',requester:'Especialista QA',requesterId:'specialist-qa',requesterRole:'especialista',status:'pendiente',requestedAt:'2026-10-10T12:00:00Z',resolvedAt:null,resolvedBy:null,resultEditorId:null,resultEditor:null,resultWorkItemId:null};
const resolvedRow:EditorialRequestSummary={...pendingRow,id:'req-done',status:'resuelta',actionable:false,assignmentReady:false,resolvedAt:'2026-10-15T12:00:00Z',resolvedBy:'Jefe de Edición QA',resultEditorId:'editor-qa',resultEditor:'Editor de verificación',resultWorkItemId:'req-done'};
const list:EditorialRequestList={items:[pendingRow],total:1,page:1,pages:1,pendingTotal:8,counts:{pending:1,resolved:4,returned:0,all:5},options:{services:[{id:'service-qa',name:'Escritura fantasma'}],requesters:[{id:'specialist-qa',name:'Especialista QA'}]}};
const detailPending:EditorialRequestDetail={files:[],recommendationSummary:null,summary:pendingRow,context:{editorialState:'Pendiente',currentEditor:null,specialist:'Especialista QA',deadline:null,waitingOn:null,blocker:null},history:[{id:'ev-1',label:'Editor solicitado por Especialista',actor:'Especialista QA',at:'2026-10-10T12:00:00Z'}]};
const detailResolved:EditorialRequestDetail={files:[],recommendationSummary:null,summary:resolvedRow,context:null,history:[{id:'ev-1',label:'Editor solicitado por Especialista',actor:'Especialista QA',at:'2026-10-10T12:00:00Z'},{id:'ev-2',label:'Editor asignado',actor:'Jefe de Edición QA',at:'2026-10-15T12:00:00Z'}]};

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
 it('no enlaza al contenedor fuera de Seguimiento ni a proyectos cerrados fuera del explorer',()=>{
  const advanced=render({...list,items:[resolvedRow]},'/?vista=solicitudes-edicion&tab=resolved&selectedRequest=req-done',detailResolved);
  expect(advanced).toContain('Ver intervenciones en Seguimiento');expect(advanced).not.toContain('workItem=req-done');
  const closed=render({...list,items:[resolvedRow]},'/?vista=solicitudes-edicion&tab=resolved&selectedRequest=req-done',{...detailResolved,summary:{...resolvedRow,projectActive:false}});
  expect(closed).toContain('Proyecto cerrado.');expect(closed).not.toContain('Ver en proyecto');expect(closed).not.toContain('Ver intervenciones en Seguimiento');
 });
 it('conserva las cuatro pestañas de detalle y permite abrir archivos desde la URL',()=>{
  const data={...detailPending,files:[{label:'Manuscrito real',url:'https://docs.google.com/document/d/qa'}]};
  const html=render(list,'/?vista=solicitudes-edicion&selectedRequest=req-qa&detailTab=archivos',data);
  for(const label of ['Resumen','Contexto','Archivos','Historial'])expect(html).toContain(label);
  expect(html).toContain('https://docs.google.com/document/d/qa');
  expect(html).not.toContain('drive.google.com/drive/folders');
 });
 it('resume la recomendación sin radios y remite a la comparación central',()=>{
  const html=render(list,'/?vista=solicitudes-edicion&selectedRequest=req-qa',{...detailPending,recommendationSummary:{rule:'editorial-descriptive-v1',observedAt:'2026-10-23T12:00:00Z',explanation:'Menor carga accionable',tied:2,editor:{id:'qa-editor',name:'Editor QA',actionableNow:7,overdue:0,dueThisWeek:2}}});
  expect(html).toContain('Editor QA');expect(html).toContain('Ver comparación completa');
  expect(html).toContain('2 Editores comparten');expect(html).not.toContain('type="radio"');
 });
 it('devuelta muestra el motivo sin acciones para asignar',()=>{
  const s={...pendingRow,status:'devuelta' as const,actionable:false,assignmentReady:false,returnReason:'Completar el material registrado.'};
  const html=render({...list,items:[s],counts:{...list.counts,returned:1}},'/?vista=solicitudes-edicion&selectedRequest=req-qa',{...detailPending,summary:s});
  expect(html).toContain('Completar el material registrado.');expect(html).not.toContain('Revisar y asignar Editor');
 });
 it('un filtro de fechas sin resultados ofrece limpiar filtros',()=>{
  const html=render({...list,items:[],total:0},'/?vista=solicitudes-edicion&from=2026-10-23');
  expect(html).toContain('No hay solicitudes con estos filtros.');expect(html).not.toContain('No tienes solicitudes pendientes.');
 });
 it('Hoy y Ayer se calculan en Caracas y conservan la hora',()=>{
  const now=new Date('2026-10-24T02:00:00Z');
  expect(requestDate('2026-10-23T21:24:00Z',now)).toBe('Hoy · 17:24');
  expect(requestDate('2026-10-23T02:24:00Z',now)).toBe('Ayer · 22:24');
 });
 it('solo existe un tipo real de solicitud: no hay columna ni filtro de prioridad, ni tipos inventados (reasignación/apoyo/escalación)',()=>{
  const html=render(list);
  expect(html).toContain('Asignación de Editor');
  expect(html).not.toMatch(/Prioridad|Reasignación|Apoyo por carga|Escalaci[oó]n/);
 });
 it('KPIs vienen del backend (counts), no se recalculan en React',()=>{
  const html=render(list);
  expect(html).toContain('>8<');
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
 it('seleccionar una solicitud pendiente abre el detalle con el CTA "Revisar y asignar Editor" que reutiliza el drawer global, sin selector propio de Editor',()=>{
  const html=render(list,'/?vista=solicitudes-edicion&selectedRequest=req-qa',detailPending);
  expect(html).toContain('Revisar y asignar Editor');
  expect(html).not.toMatch(/ec-editor-choice|Seleccionar Editor/);
 });
 it('detalle de una solicitud resuelta muestra el resultado (Editor asignado, quién resolvió) en modo lectura',()=>{
  const html=render({...list,items:[resolvedRow]},'/?vista=solicitudes-edicion&tab=resolved&selectedRequest=req-done',detailResolved);
  expect(html).toContain('Editor de verificación');
  expect(html).toContain('Jefe de Edición QA');
  expect(html).not.toContain('Revisar y asignar Editor');
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
