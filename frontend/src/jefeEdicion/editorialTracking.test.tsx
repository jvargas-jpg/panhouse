import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorialTracking} from './EditorialTracking';
import type {EditorialTrackingDetail,EditorialTrackingList,EditorialTrackingRow} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);

const row:EditorialTrackingRow={id:'work-qa',workItemId:'work-qa',projectId:'project-qa',title:'Proyecto de verificación',authors:'Autora de prueba',code:'QAS01',service:'Escritura fantasma',coverUrl:null,label:'Capítulo 4',editorId:'editor-qa',editor:'Editor de verificación',state:'Requiere ajustes',dueDate:'2026-10-20',overdue:true,atRisk:false,actionable:true,needsAssignment:false,requestedAt:'2026-10-10T12:00:00Z',requestedBy:'Especialista QA',situation:'Vencida',cta:'Ver seguimiento',chapter:4,deliveredAt:null,block:null,serviceId:'service-qa',serviceCode:'EF',subtype:null,interventionType:'chapter',volume:'1 capítulo',notes:null,requestedById:'specialist-qa',requestedByRole:'especialista',waitingOn:null,assignmentId:'assign-qa',plannedDueDate:'2026-10-20',currentResponsible:'editor',daysLabel:'Vencida hace 3 días'};
const list:EditorialTrackingList={items:[row],total:13,page:1,pages:2,counts:{overdue:13,risk:0,blocked:0,waitingThirdParty:32,priority:13,all:120},options:{services:[{id:'service-qa',name:'Escritura fantasma'}],editors:[{id:'editor-qa',name:'Editor de verificación'}],states:['Requiere ajustes','Esperando autor'],interventionTypes:[{id:'chapter',name:'Capítulo'}]}};
const detail:EditorialTrackingDetail={summary:row,project:{id:'project-qa',code:'QAS01',title:'Proyecto de verificación',authors:'Autora de prueba',service:'Escritura fantasma',coverUrl:null},specialist:'Especialista QA',specialistId:'specialist-qa',nextStep:'Pendiente por el Editor: Capítulo 4.',riskReason:null,blockerReason:null,siblings:[{id:'sib-1',label:'Capítulo 5',state:'Esperando autor',dueDate:null,overdue:false},{id:'sib-2',label:'Capítulo 6',state:'Pendiente',dueDate:null,overdue:false}],siblingsTotal:2,drive:{rootUrl:null,links:[],files:[]},history:[{id:'ev-1',label:'Capítulo entregado por Editor',actor:'Editor de verificación',at:'2026-10-15T12:00:00Z'}]};

function render(data:EditorialTrackingList|undefined,url='/?vista=seguimiento-edicion',selectedDetail:EditorialTrackingDetail|undefined=undefined,error?:'list'|'detail'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 const urlParams=new URL(url,'http://local').searchParams;
 const queryParams=new URLSearchParams({tab:urlParams.get('tab')??'priority',page:urlParams.get('page')??'1',pageSize:urlParams.get('pageSize')??'10',sort:urlParams.get('sort')??'due'});
 for(const key of ['search','service','status','editor','responsible','interventionType','from','to'])if(urlParams.get(key))queryParams.set(key,urlParams.get(key)!);
 const listKey=['editorial-chief','tracking',queryParams.toString()];
 const workItemId=urlParams.get('workItem');
 const detailKey=['editorial-chief','tracking-detail',workItemId];
 if(data)client.setQueryData(listKey,data);
 if(selectedDetail)client.setQueryData(detailKey,selectedDetail);
 if(error){const key=error==='list'?listKey:detailKey;client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',error:new Error('QA fallida'),fetchStatus:'idle'});}
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><EditorialTracking/></StaticRouter></QueryClientProvider>);
 client.clear();return html;
}
describe('Seguimiento · página',()=>{
 it('una fila = una intervención; no hay botón Asignar ni fila "Por asignar"',()=>{
  const html=render(list);
  expect(html).toContain('Capítulo 4');expect(html).toContain('Ver seguimiento');
  expect(html).not.toContain('>Asignar<');expect(html).not.toContain('Por asignar<');
 });
 it('tab por defecto es Prioritarios, con KPIs de vencidas/riesgo/bloqueadas/esperando terceros',()=>{
  const html=render(list);
  expect(html).toContain('aria-selected="true"');
  expect(html).toContain('Vencidas');expect(html).toContain('En riesgo');expect(html).toContain('Bloqueadas');expect(html).toContain('Esperando terceros');
  expect(html).not.toContain('Completadas esta semana');
 });
 it('responsable actual se muestra explícito por fila, distinto del Editor asignado',()=>{
  const html=render(list);
  expect(html).toContain('Editor de verificación');
  expect(html).toContain('Editor</td>');
 });
 it('fecha vencida usa texto con contexto, nunca un número negativo crudo',()=>{
  const html=render(list);
  expect(html).toContain('Vencida hace 3 días');
  expect(html).not.toMatch(/>-3</);
 });
 it('esperando tercero no se pinta en rojo (waitingOn neutral)',()=>{
  const waiting={...row,id:'work-wait',state:'Esperando autor' as const,overdue:false,currentResponsible:'autor' as const,daysLabel:'SLA en pausa',waitingOn:'author' as const};
  const html=render({...list,items:[waiting]});
  expect(html).toContain('SLA en pausa');
  expect(html).not.toMatch(/ec-deadline-overdue"[^>]*>SLA en pausa/);
 });
 it('seleccionar fila abre panel centrado en la intervención con siblings como contexto secundario',()=>{
  const html=render(list,'/?vista=seguimiento-edicion&workItem=work-qa',detail);
  expect(html).toContain('Responsable actual');
  expect(html).toContain('Pendiente por el Editor');
  expect(html).toContain('Otras intervenciones de este proyecto');
  expect(html).toContain('Capítulo 5');
  expect(html).toContain('Ver en proyecto');expect(html).toContain('Reasignar');
 });
 it('no hay acciones para operar el trabajo del Editor desde el panel',()=>{
  const html=render(list,'/?vista=seguimiento-edicion&workItem=work-qa',detail);
  expect(html).not.toMatch(/Marcar entregado|Completar capítulo|Aplicar feedback|Subir versión/);
 });
 it('vacío de prioritarios es un buen estado, no un error',()=>{
  const html=render({...list,items:[],total:0,counts:{...list.counts,priority:0}});
  expect(html).toContain('No hay intervenciones que requieran atención inmediata.');
 });
 it('exportar deshabilitado sin datos; error de lista y de detalle son independientes',()=>{
  expect(render(undefined)).toContain('disabled=""');
  expect(render(undefined,'/?vista=seguimiento-edicion',undefined,'list')).toContain('Reintentar');
  const html=render(list,'/?vista=seguimiento-edicion&workItem=work-qa',undefined,'detail');
  expect(html).toContain('Capítulo 4');
  expect(html).toContain('No se pudo cargar la intervención');
 });
});
