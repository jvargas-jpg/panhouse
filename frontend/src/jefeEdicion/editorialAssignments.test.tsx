import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorialAssignments,EditorialAssignmentRows,EditorialTeamCards} from './EditorialAssignments';
import {AsignarEditorCard} from './EditorialDrawers';
import type {EditorialAssignmentList,EditorialIntervention,EditorialLoadSummary,EditorialRecommendation} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);
const item:EditorialIntervention={id:'request',workItemId:'request',projectId:'project',title:'Proyecto de verificación',authors:'Autora de prueba',code:'VER',service:'Servicio real',serviceCode:'CAT',coverUrl:null,label:'Inicio de edición',interventionType:'default',editorId:null,editor:null,state:'Pendiente',dueDate:'2026-10-26',overdue:false,atRisk:false,actionable:false,needsAssignment:true,requestedAt:'2026-10-23T12:00:00Z',requestedBy:'Especialista de prueba',requestedByRole:'especialista',situation:'Por asignar',cta:'Asignar',chapter:null,deliveredAt:null,block:null};
const list:EditorialAssignmentList={items:[item],total:12,page:1,pages:2,counts:{unassigned:12,editing:8,waiting:4,overdue:2,all:25},options:{services:[{id:'service',name:'Servicio real'}],interventionTypes:[{id:'default',name:'Inicio de edición'}],specialists:[{id:'specialist',name:'Especialista de prueba'}],editors:[],states:['Pendiente']}};
const team:EditorialLoadSummary={today:'2026-10-23',updatedAt:'2026-10-23T12:00:00Z',editors:[{id:'editor',name:'Editor de verificación',activeAssigned:7,actionableNow:4,waitingThirdParty:3,overdue:1,dueThisWeek:2,nextDeliveries:[{id:'chapter',title:item.title,label:'Capítulo 2',dueDate:'2026-10-23',overdue:false}]}]};
const recommendation:EditorialRecommendation={rule:'editorial-descriptive-v1',observedAt:team.updatedAt,recommendedIds:['editor'],candidates:[{...team.editors[0]!,rank:1,reasons:['4 intervenciones accionables ahora.','1 entrega vencida.']}],explanation:'Menor cantidad accionable, luego vencidas y entregas esta semana.',limitations:'Sin capacidad formal.'};
function render(node:React.ReactNode,{location='/',result=list,load=team,candidates=recommendation,error=''}:{location?:string;result?:EditorialAssignmentList|null;load?:EditorialLoadSummary|null;candidates?:EditorialRecommendation|null;error?:string}={}){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 const listKey=['editorial-chief','assignments','tab=unassigned&page=1&pageSize=10&sort=due'];
 if(result)client.setQueryData(listKey,result);if(load)client.setQueryData(['editorial-chief','team'],load);if(candidates)client.setQueryData(['editorial-chief','candidates','request'],candidates);
 if(error){const key=error==='list'?listKey:error==='team'?['editorial-chief','team']:['editorial-chief','candidates','request'];client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',error:new Error('QA error'),fetchStatus:'idle'});}
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={location}>{node}</StaticRouter></QueryClientProvider>);client.clear();return html;
}
describe('Asignaciones y carga · presentación de decisiones',()=>{
 it('tabs usan totales backend, Por asignar es default y conserva filtros reales y paginación',()=>{
  const html=render(<EditorialAssignments onOpen={()=>{}} onLoad={()=>{}}/>);expect(html).toContain('Por asignar <span>12</span>');expect(html).toContain('En edición <span>8</span>');expect(html).toContain('aria-selected="true"');for(const s of ['Servicio','Tipo de intervención','Fecha requerida','Especialista solicitante','Estado','Limpiar filtros','Por página','1 / 2'])expect(html).toContain(s);expect(html).not.toMatch(/type="checkbox"|Asignación rápida|Nueva asignación/);
 });
 it('tabla muestra origen y campos reales, distingue acciones y declara volumen ausente',()=>{
  const html=render(<EditorialAssignmentRows items={[item,{...item,id:'assigned',needsAssignment:false,editor:'Editor actual',overdue:true}]} onOpen={()=>{}} tab="all"/>);for(const value of ['Especialista de prueba','Sin volumen registrado','CAT','Asignar','Ver seguimiento','Sin portada registrada'])expect(html).toContain(value);expect(html).not.toContain('<img');
 });
 it('cards separan asignadas, accionables y esperas, con entregas; no fabrican capacidad',()=>{
  const html=render(<EditorialTeamCards data={team} onLoad={()=>{}} onOpen={()=>{}}/>);expect(html).toContain('7 asignadas · 3 en espera');expect(html).toContain('<dd>4</dd><dt>Accionables</dt>');expect(html).toContain('Capítulo 2');expect(html).toContain('Ver carga completa');expect(html).not.toMatch(/%|Disponible|Saturado|Mejor opción/);
 });
 it('cards escalan con paginación del equipo y vacío honesto',()=>{
  const many={...team,editors:Array.from({length:14},(_,i)=>({...team.editors[0]!,id:String(i),name:`Editor número ${i}`}))};const html=render(<EditorialTeamCards data={many} onLoad={()=>{}} onOpen={()=>{}}/>);expect(html).toContain('Más Editores');expect(html).not.toContain('Editor número 7');expect(render(<EditorialTeamCards data={{...team,editors:[]}} onLoad={()=>{}} onOpen={()=>{}}/>)).toContain('No hay Editores elegibles.');
 });
 it('candidatos no se preseleccionan y recomendación explica hechos sin impedir otra elección',()=>{
  const html=render(<AsignarEditorCard item={item} onAssigned={()=>{}}/>);expect(html).toContain('Recomendación del sistema');expect(html).toContain('4 intervenciones accionables ahora.');expect(html).not.toContain('checked=""');expect(html).toMatch(/disabled=""[^>]*>Selecciona un Editor/);expect(html).toContain('Menos vencidas');expect(html).not.toContain('Mejor opción');
 });
 it('empates y falta de recomendación se presentan sin ganador ficticio',()=>{
  const tie={...recommendation,recommendedIds:['editor','other'],candidates:[...recommendation.candidates,{...recommendation.candidates[0]!,id:'other',name:'Otro Editor'}]};expect(render(<AsignarEditorCard item={item} onAssigned={()=>{}}/>,{candidates:tie})).toContain('Empate según los datos disponibles.');const html=render(<AsignarEditorCard item={item} onAssigned={()=>{}}/>,{candidates:{...recommendation,recommendedIds:[],candidates:[]}});expect(html).toContain('No hay Editores elegibles.');expect(html).toContain('No hay una recomendación automática con los datos disponibles.');
 });
 it('loading usa skeletons y un fallo de carga conserva la lista independiente',()=>{
  expect(render(<EditorialAssignments onOpen={()=>{}} onLoad={()=>{}}/>,{result:null,load:null})).toContain('Cargando intervenciones');const html=render(<EditorialAssignments onOpen={()=>{}} onLoad={()=>{}}/>,{error:'team'});expect(html).toContain('Proyecto de verificación');expect(html).toContain('Reintentar carga');expect(render(<AsignarEditorCard item={item} onAssigned={()=>{}}/>,{error:'candidates'})).toContain('Reintentar candidatos');
 });
 it('lista vacía muestra mensaje y siguiente paso; reasignación exige motivo',()=>{
  const html=render(<EditorialAssignments onOpen={()=>{}} onLoad={()=>{}}/>,{result:{...list,items:[],total:0}});expect(html).toContain('No hay intervenciones pendientes de asignación.');expect(html).toContain('Las nuevas solicitudes de Editor aparecerán aquí.');expect(render(<AsignarEditorCard item={{...item,editorId:'current'}} onAssigned={()=>{}}/>)).toContain('textarea name="motivo" required="" minLength="5"');
 });
});
