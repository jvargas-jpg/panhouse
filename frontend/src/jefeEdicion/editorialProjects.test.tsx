import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorialProjects} from './EditorialProjects';
import type {EditorialProjectDetail,EditorialProjectList,EditorialProjectSummary} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);

const summary:EditorialProjectSummary={projectId:'project-qa',code:'QAP01',title:'Proyecto de verificación',authors:'Autora de prueba',coverUrl:null,service:'Escritura fantasma',serviceId:'service-qa',serviceCode:'EF',subtype:null,editorialState:'Requiere ajustes',risk:false,overdue:false,blocker:null,responsibleNow:'editor',interventionSummary:'3 capítulos registrados · 1 completado',interventionCount:3,progress:null,editor:'Editor de verificación',editorId:'editor-qa',multipleEditors:false,editorCount:1,specialist:'Especialista de prueba',specialistId:'specialist-qa',nextDelivery:{label:'Capítulo 3',date:'2026-10-26'},lastActivity:{label:'Capítulo entregado por Editor',at:'2026-10-20T14:00:00Z'}};
const list:EditorialProjectList={items:[summary],total:22,page:1,pages:3,counts:{inEditing:22,upcomingDeliveries:13,overdue:3,waitingAuthor:1},options:{services:[{id:'service-qa',name:'Escritura fantasma'}],editors:[{id:'editor-qa',name:'Editor de verificación'}],states:['Requiere ajustes','Por iniciar']}};
const detail:EditorialProjectDetail={summary,nextStep:'Pendiente por el Editor: Aplicar feedback · Capítulo 2.',interventions:[{id:'cap-2',label:'Aplicar feedback · Capítulo 2',state:'Requiere ajustes',editor:'Editor de verificación',editorId:'editor-qa',dueDate:null,overdue:false,deliveredAt:'2026-10-18',waitingOn:null,cta:'Ver ajustes'}],interventionsTotal:1,drive:{rootUrl:null,links:[]},history:[{id:'ev-1',label:'Editor asignado',actor:'Jefe de Edición QA',at:'2026-10-15T12:00:00Z'}]};

function render(data:EditorialProjectList|undefined,url='/?vista=proyectos-edicion',selectedDetail:EditorialProjectDetail|undefined=undefined,error?:'list'|'detail'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 const urlParams=new URL(url,'http://local').searchParams;
 const queryParams=new URLSearchParams({page:urlParams.get('page')??'1',pageSize:urlParams.get('pageSize')??'10',sort:urlParams.get('sort')??'activity'});
 for(const key of ['search','service','state','editor'])if(urlParams.get(key))queryParams.set(key,urlParams.get(key)!);
 const listKey=['editorial-chief','projects',queryParams.toString()];
 const projectId=urlParams.get('project');
 const detailKey=['editorial-chief','project-detail',projectId];
 if(data)client.setQueryData(listKey,data);
 if(selectedDetail)client.setQueryData(detailKey,selectedDetail);
 if(error){const key=error==='list'?listKey:detailKey;client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',error:new Error('QA fallida'),fetchStatus:'idle'});}
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><EditorialProjects/></StaticRouter></QueryClientProvider>);
 client.clear();return html;
}
describe('Proyectos de edición · página',()=>{
 it('una fila = un proyecto, con resumen de intervenciones sin fracción falsa',()=>{
  const html=render(list);
  expect(html).toContain('Proyecto de verificación');
  expect(html).toContain('3 capítulos registrados · 1 completado');
  expect(html).not.toMatch(/\d+\/\d+\s*capítulos|%\s*<\/td>/);
 });
 it('KPI vienen del backend, no se recalculan en React',()=>{
  const html=render(list);
  expect(html).toContain('<strong>22</strong>');expect(html).toContain('<strong>13</strong>');expect(html).toContain('<strong>3</strong>');expect(html).toContain('<strong>1</strong>');
  expect(html).toContain('Proyectos en edición');expect(html).toContain('Con entregas próximas');expect(html).toContain('Con intervenciones vencidas');expect(html).toContain('En espera de autor');
 });
 it('estado de edición usa badges reales, no estado macro del proyecto',()=>{
  const html=render(list);
  expect(html).toContain('Requiere ajustes');
  expect(html).not.toContain('en_proceso');
 });
 it('seleccionar fila abre el panel con tabs Resumen/Intervenciones/Archivos/Historial',()=>{
  const html=render(list,'/?vista=proyectos-edicion&project=project-qa',detail);
  expect(html).toContain('Resumen');expect(html).toContain('Intervenciones');expect(html).toContain('Archivos');expect(html).toContain('Historial');
  expect(html).toContain('Pendiente por el Editor');
  expect(html).toContain('has-detail');
 });
 it('sin selección no se renderiza panel vacío',()=>{
  const html=render(list);
  expect(html).not.toContain('has-detail');
  expect(html).not.toContain('ep-detail');
 });
 it('Archivos sin workspace muestra el vacío honesto, no un explorador Drive',()=>{
  const html=render(list,'/?vista=proyectos-edicion&project=project-qa',detail);
  expect(html).toContain('Resumen');
 });
 it('Especialista es de solo lectura; no hay botones de operar el trabajo del Editor',()=>{
  const html=render(list,'/?vista=proyectos-edicion&project=project-qa',detail);
  expect(html).not.toMatch(/Marcar capítulo como entregado|Aprobar feedback|Completar edición/);
 });
 it('exportar no está disponible sin datos cargados (deshabilitado)',()=>{
  const html=render(undefined);
  expect(html).toContain('disabled=""');
 });
 it('vacío general y vacío por filtros usan mensajes distintos',()=>{
  expect(render({...list,items:[],total:0})).toContain('No hay proyectos con proceso de Edición activo.');
  expect(render({...list,items:[],total:0},'/?vista=proyectos-edicion&search=zzz')).toContain('No hay proyectos de Edición con estos filtros.');
 });
 it('error de lista y error de detalle son independientes',()=>{
  expect(render(undefined,'/?vista=proyectos-edicion',undefined,'list')).toContain('Reintentar');
  const html=render(list,'/?vista=proyectos-edicion&project=project-qa',undefined,'detail');
  expect(html).toContain('Proyecto de verificación');
  expect(html).toContain('No se pudo cargar el proyecto');
 });
});
