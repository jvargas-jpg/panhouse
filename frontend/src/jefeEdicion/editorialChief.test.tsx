import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {JefeEdicionHomePage} from './JefeEdicionHomePage';
import {EditorialKpis,EditorialTeam,EditorialRows,EditorialDistribution} from './EditorialParts';
import {AsignarEditorCard} from './AsignarEditorCard';
import type {EditorialDashboard,EditorialIntervention} from '../../../shared/editorialChief';
vi.stubGlobal('React',React);
const item:EditorialIntervention={id:'request',workItemId:'request',projectId:'project',title:'Proyecto de prueba',authors:'Autora QA',code:'QA',service:'Servicio del catálogo',coverUrl:null,label:'Inicio de edición',editorId:null,editor:null,state:'Pendiente',dueDate:null,overdue:false,atRisk:false,actionable:false,needsAssignment:true,requestedAt:'2026-10-23T12:00:00Z',situation:'Por asignar',cta:'Asignar',chapter:null,deliveredAt:null,block:null};
const data:EditorialDashboard={updatedAt:'2026-10-23T12:00:00Z',today:'2026-10-23',summary:{unassigned:1,overdue:0,atRisk:0,pendingRequests:1},editorLoads:[{id:'editor',name:'Editor QA',active:2,upcoming:1,overdue:0,waiting:1}],interventionDistribution:[{state:'En edición',count:2},{state:'Esperando autor',count:1}],attentionItems:[item],attentionTotal:1,upcomingDeliveries:[],pendingRequests:[{id:'request',projectId:'project',title:'Proyecto de prueba',authors:'Autora QA',label:'Asignación de Editor',requestedAt:'2026-10-23T12:00:00Z',requestedBy:'Especialista QA',state:'Pendiente'}]};
function render(node:React.ReactNode,dashboard:EditorialDashboard|null=data,activityError=false){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});client.setQueryData(['auth','me'],{id:'chief',rol:'jefe_edicion',nombre:'Jefatura QA'});
 if(dashboard)client.setQueryData(['editorial-chief','dashboard'],dashboard);
 if(dashboard)client.setQueryData(['editorial-chief','candidates','request'],{recommendedIds:['editor'],candidates:[{id:'editor',name:'Editor QA',actionableNow:2,dueThisWeek:1,overdue:0,activeAssigned:3,waitingThirdParty:1,rank:1,reasons:['2 intervenciones accionables.']}],explanation:'Comparación descriptiva',limitations:'Sin capacidad formal'});
 if(activityError){const q=client.getQueryCache().build(client,{queryKey:['editorial-chief','activity']});q.setState({status:'error',error:new Error('Activity unavailable'),fetchStatus:'idle'});}else client.setQueryData(['editorial-chief','activity'],{items:[]});
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/">{node}</StaticRouter></QueryClientProvider>);client.clear();return html;
}
describe('Inicio de Jefe de Edición',()=>{
 it('exactamente cuatro KPI accionables sin completadas ni período artificial',()=>{const html=render(<EditorialKpis data={data}/>);expect((html.match(/class="ec-kpi ec-/g)??[]).length).toBe(4);for(const label of ['Por asignar','Entregas vencidas','En riesgo','Solicitudes pendientes'])expect(html).toContain(label);expect(html).not.toMatch(/Entregas completadas|Este mes/);});
 it('carga descriptiva sin capacidad o porcentajes inventados',()=>{const html=render(<EditorialTeam data={data} onLoad={()=>{}}/>);expect(html).toContain('Editor QA');expect(html).toContain('Vencen esta semana');expect(html).not.toContain('%');});
 it('atención con contexto, servicio real y CTA específico; vacío honesto',()=>{const html=render(<EditorialRows items={[item]} onOpen={()=>{}}/>);expect(html).toContain('Proyecto de prueba');expect(html).toContain('Servicio del catálogo');expect(html).toContain('Asignar');expect(render(<EditorialRows items={[]} onOpen={()=>{}}/>)).toContain('No hay situaciones que requieran tu atención.');});
 it('distribución identifica intervenciones y esperas sin progreso global',()=>{const html=render(<EditorialDistribution data={data.interventionDistribution}/>);expect(html).toContain('Esperando autor: 1');expect(html).toContain('Intervenciones');expect(html).not.toMatch(/% completado|Progreso/);});
 it('fallo de actividad local mantiene KPI y atención; footer institucional no tiene ruta',()=>{const html=render(<JefeEdicionHomePage/>,data,true);expect(html).toContain('Reintentar actividad');expect(html).toContain('Requieren tu atención');expect(html).toContain('Proyecto de prueba');expect(html).toContain('<p>Historias que conectan.</p>');expect(html).not.toMatch(/<a[^>]*>Historias que conectan/);});
 it('loading local con skeleton y estados vacíos por bloque',()=>{expect(render(<JefeEdicionHomePage/>,null)).toContain('Cargando centro de Edición');const html=render(<JefeEdicionHomePage/>,{...data,attentionItems:[],pendingRequests:[],editorLoads:[],interventionDistribution:[]});for(const label of ['No hay situaciones que requieran tu atención.','No tienes solicitudes pendientes.','No hay Editores disponibles en el equipo.'])expect(html).toContain(label);});
 it('formulario de asignación reutilizado muestra equipo y bloqueo inicial de confirmación',()=>{const html=render(<AsignarEditorCard item={item} onAssigned={()=>{}}/>);expect(html).toContain('Selecciona un Editor');expect(html).toContain('Editor QA');expect(html).toMatch(/disabled=""[^>]*>Selecciona un Editor/);expect(html).not.toContain('carga:');});
});
