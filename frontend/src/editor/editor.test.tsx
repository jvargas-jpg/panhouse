import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorInicio} from './EditorInicio';
import {EditorMiTrabajo} from './EditorMiTrabajo';
import {EditorMisProyectos} from './EditorMisProyectos';
import {EditorMisSolicitudes} from './EditorMisSolicitudes';
import type {EditorDashboard, EditorRequestList} from '../../../shared/editorOwn';
import type {EditorialIntervention, EditorialProjectList} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);

const item:EditorialIntervention={id:'work-qa',workItemId:'work-qa',projectId:'project-qa',title:'Proyecto de verificación',authors:'Autora de prueba',code:'QAS01',service:'Escritura fantasma',coverUrl:null,label:'Capítulo 4',editorId:'editor-qa',editor:'Editor de verificación',state:'En edición',dueDate:'2026-10-20',overdue:true,atRisk:false,actionable:true,needsAssignment:false,requestedAt:null,situation:'Vencida',cta:'Abrir',chapter:4,deliveredAt:null,block:null,serviceId:'service-qa',serviceCode:'EF',subtype:null,interventionType:'chapter',volume:'1 capítulo',notes:null,waitingOn:null};

const dashboard:EditorDashboard={
 today:'2026-10-25',
 summary:{pendingToday:1,dueSoon:0,blocked:0,feedbackToApply:0},
 attentionItems:[item],
 upcomingDeliveries:[],
 recentActivity:[{id:'f1',text:'Feedback del autor registrado',title:'Proyecto de verificación',actor:'Especialista QA',at:'2026-10-20T12:00:00Z'}],
 weekStatus:{completed:2,inProgress:3,dueSoon:0,blocked:0},
};
const workRow={...item,lastActivity:{label:'Entrega registrada',at:'2026-10-20T12:00:00Z'}};
const miTrabajoList={items:[workRow],total:1,pages:1,page:1,counts:{all:1,today:1,inProgress:0,feedback:0,waiting:0,completed:0}};
const misProyectosList:EditorialProjectList={items:[{projectId:'project-qa',code:'QAS01',title:'Proyecto de verificación',authors:'Autora de prueba',coverUrl:null,service:'Escritura fantasma',serviceId:'service-qa',serviceCode:'EF',subtype:null,editorialState:'En edición',risk:false,overdue:true,blocker:null,responsibleNow:'editor',interventionSummary:'5 capítulos registrados · 2 completados',interventionCount:5,progress:null,editor:'Editor de verificación',editorId:'editor-qa',multipleEditors:false,editorCount:1,specialist:'Especialista QA',specialistId:'spec-qa',nextDelivery:{label:'Capítulo 4',date:'2026-10-20'},lastActivity:{label:'Entrega registrada',at:'2026-10-20T12:00:00Z'}}],total:1,page:1,pages:1,counts:{inEditing:1,upcomingDeliveries:1,overdue:1,waitingAuthor:0},options:{services:[],editors:[],states:[],specialists:[]}};
const misSolicitudesList:EditorRequestList={items:[{id:'req-1',type:'editor_apoyo',projectId:'project-qa',code:'QAS01',title:'Proyecto de verificación',workItemId:'work-qa',interventionLabel:'Capítulo 4',motivo:'Necesito apoyo con este capítulo',status:'pendiente',target:'Jefe de Edición',requestedAt:'2026-10-25T12:00:00Z',resolvedAt:null,outcome:null,version:1}],total:1,pages:1,page:1,counts:{pending:1,resolved:0,returned:0,cancelled:0,all:1}};

function render(node:React.ReactElement,seed:(c:QueryClient)=>void,url='/'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 seed(client);
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}>{node}</StaticRouter></QueryClientProvider>);
 client.clear();return html;
}

describe('Editor · Inicio',()=>{
 it('muestra los 4 KPI, el bloque de atención y no inventa agenda/porcentaje semanal',()=>{
  const html=render(<EditorInicio/>,c=>c.setQueryData(['editor','inicio'],dashboard));
  expect(html).toContain('Pendientes hoy');expect(html).toContain('Por vencer');expect(html).toContain('Bloqueadas');expect(html).toContain('Feedback por aplicar');
  expect(html).toContain('Proyecto de verificación');expect(html).toContain('Capítulo 4');
  expect(html).not.toContain('Agenda de hoy');
  expect(html).toContain('Estado de mi trabajo esta semana');
  expect(html).not.toMatch(/%\s*</);
 });
 it('vacío de atención es un buen estado, no un error',()=>{
  const html=render(<EditorInicio/>,c=>c.setQueryData(['editor','inicio'],{...dashboard,attentionItems:[]}));
  expect(html).toContain('No tienes trabajo que requiera atención inmediata.');
 });
 it('error de carga ofrece reintentar',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false}}});
  client.getQueryCache().build(client,{queryKey:['editor','inicio']}).setState({status:'error',error:new Error('QA fallida'),fetchStatus:'idle'});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/"><EditorInicio/></StaticRouter></QueryClientProvider>);
  expect(html).toContain('Reintentar');
 });
});

describe('Editor · Mi trabajo',()=>{
 it('una fila = un work item, sin KPI cards y con última actividad real',()=>{
  const html=render(<EditorMiTrabajo/>,c=>c.setQueryData(['editor','mi-trabajo','tab=all&search=&page=1&pageSize=10'],miTrabajoList));
  expect(html).toContain('Capítulo 4');expect(html).toContain('Pendientes');expect(html).toContain('Bloqueadas');expect(html).toContain('Entrega registrada');
  expect(html).toContain('Vencida');expect(html).toContain('Ordenar intervenciones');expect(html).toContain('Filtros');
  expect(html).not.toContain('Intervenciones activas');
 });
 it('vacío con filtros explica, no es un error',()=>{
  const html=render(<EditorMiTrabajo/>,c=>c.setQueryData(['editor','mi-trabajo','tab=all&search=&page=1&pageSize=10'],{...miTrabajoList,items:[],total:0}));
  expect(html).toContain('No tienes intervenciones asignadas con estos filtros.');
 });
 it('el resumen distingue responsable actual, pausa y acciones de una espera real',()=>{
  const waiting={...item,state:'Esperando autor',waitingOn:'author',actionable:false,overdue:false,dueDate:null};
  const html=render(<EditorMiTrabajo/>,c=>{
   c.setQueryData(['editor','mi-trabajo','tab=all&search=&page=1&pageSize=10'],{...miTrabajoList,items:[{...waiting,lastActivity:null}]});
   c.setQueryData(['editor','mi-trabajo-detalle','work-qa'],{item:waiting,folders:[],deliveries:[],blocker:null,history:[],slaLabel:'3 días hábiles desde el inicio'});
  });
  expect(html).toContain('Responsable actual');expect(html).toContain('SLA en pausa');expect(html).toContain('Resumen');
  expect(html).toContain('Esperando la respuesta del autor');expect(html).not.toContain('Registrar entrega');expect(html).not.toContain('Reportar bloqueo');
 });
 it('un detalle fallido permite reintentar y conserva las filas cargadas',()=>{
  const html=render(<EditorMiTrabajo/>,c=>{
   c.setQueryData(['editor','mi-trabajo','tab=all&search=&page=1&pageSize=10'],miTrabajoList);
   c.getQueryCache().build(c,{queryKey:['editor','mi-trabajo-detalle','work-qa']}).setState({status:'error',error:new Error('Fallo de detalle'),fetchStatus:'idle'});
  });
  expect(html).toContain('No se pudo cargar la intervención.');expect(html).toContain('Capítulo 4');expect(html).toContain('Reintentar');
 });
});

describe('Editor · Mis proyectos',()=>{
 it('una fila = un proyecto, con participación real y sin progreso inventado',()=>{
  const html=render(<EditorMisProyectos/>,c=>c.setQueryData(['editor','mis-proyectos','search=&page=1&pageSize=25&sort=priority'],misProyectosList));
  expect(html).toContain('Proyecto de verificación');expect(html).toContain('QAS01');
  expect(html).toContain('5 capítulos registrados · 2 completados');
  expect(html).not.toMatch(/\d+%/);
 });
 it('vacío: no tienes proyectos activos', () => {
  const html=render(<EditorMisProyectos/>,c=>c.setQueryData(['editor','mis-proyectos','search=&page=1&pageSize=25&sort=priority'],{...misProyectosList,items:[]}));
  expect(html).toContain('No tienes proyectos editoriales activos.');
 });
});

describe('Editor · Mis solicitudes',()=>{
 it('es la outbox del Editor: código de tipo cerrado, destino y motivo visibles',()=>{
  const html=render(<EditorMisSolicitudes/>,c=>c.setQueryData(['editor','mis-solicitudes','tab=all&page=1&pageSize=25'],misSolicitudesList));
  expect(html).toContain('Solicitud de apoyo');expect(html).toContain('Jefe de Edición');expect(html).toContain('Necesito apoyo con este capítulo');
  expect(html).not.toContain('Tipos más frecuentes');
 });
 it('vacío: aún no has enviado solicitudes',()=>{
  const html=render(<EditorMisSolicitudes/>,c=>c.setQueryData(['editor','mis-solicitudes','tab=all&page=1&pageSize=25'],{...misSolicitudesList,items:[],counts:{pending:0,resolved:0,returned:0,cancelled:0,all:0}}));
  expect(html).toContain('Aún no has enviado solicitudes.');
 });
});
