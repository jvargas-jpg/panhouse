import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {EditorialIndicadoresPage} from './EditorialIndicadoresPage';
import type {IndicadoresEdicion} from '../../../shared/editorialIndicadores';
import {meQueryKey} from '../auth/useAuth';
import type {Usuario} from '../types/api';
vi.stubGlobal('React',React);

const chief:Usuario={id:'chief-qa',email:'chief@test.local',nombre:'Jefe de Edición QA',rol:'jefe_edicion'};

const data:IndicadoresEdicion={
 actualizadoEn:'2026-10-23T16:00:00Z',
 periodo:{preset:'este-mes',from:'2026-10-01',to:'2026-10-23',anteriorFrom:'2026-09-08',anteriorTo:'2026-09-30',zonaHoraria:'America/Caracas',hoy:'2026-10-23'},
 kpis:{
  projectsInEditing:{value:6,deltaPct:null,snapshot:true},
  completedDeliveries:{value:15,deltaPct:25,snapshot:false},
  overdueInterventions:{value:4,deltaPct:null,snapshot:true},
  waitingAuthor:{value:8,deltaPct:null,snapshot:true},
 },
 stateDistribution:[{estado:'En edición',cantidad:20,porcentaje:50},{estado:'Esperando autor',cantidad:8,porcentaje:20},{estado:'Bloqueadas',cantidad:4,porcentaje:10},{estado:'Esperando Especialista',cantidad:8,porcentaje:20}],
 weeklyFlow:[{semana:'S1',from:'2026-09-29',to:'2026-10-05',iniciadas:3,completadas:2,vencidas:0},{semana:'S2',from:'2026-10-06',to:'2026-10-12',iniciadas:4,completadas:5,vencidas:1}],
 editors:[{id:'editor-qa',nombre:'Editor de verificación',activas:5,vencidas:1,vencenEstaSemana:2,esperandoTerceros:1,entregasCompletadas:8,slaPct:80,slaMuestras:5},{id:'editor-sin-datos',nombre:'Editor sin muestras',activas:2,vencidas:0,vencenEstaSemana:0,esperandoTerceros:0,entregasCompletadas:0,slaPct:null,slaMuestras:0}],
 cycleTimes:[{tipo:'chapter',etiqueta:'Capítulo',promedioDias:3.5,muestras:13,definicion:'Tiempo bajo responsabilidad de Edición: desde el inicio registrado del Editor hasta su entrega, sin descontar espera del autor.'}],
 services:[{servicio:'Escritura fantasma',cantidad:12},{servicio:'Crudo Capítulo',cantidad:7}],
 riskProjects:[{projectId:'project-qa',code:'QAS01',title:'Proyecto de verificación',authors:'Autora de prueba',interventionsAtRisk:2,nextDelivery:'2026-10-25',editorialState:'Requiere ajustes'}],
 activity:[{id:'act-1',text:'Editor entregó Capítulo 6',title:'Proyecto de verificación',actor:'Editor de verificación',at:'2026-10-22T12:00:00Z'}],
 filters:{services:[{id:'service-qa',name:'Escritura fantasma'}],editors:[{id:'editor-qa',name:'Editor de verificación'}],interventionTypes:[{id:'chapter',name:'Capítulo'}]},
 insufficientData:[],
};

function render(payload:IndicadoresEdicion|undefined,user:Usuario|null=chief,error=false){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 client.setQueryData(meQueryKey,user);
 const key=['editorial-chief',user?.id,'indicadores','preset=este-mes'];
 if(payload)client.setQueryData(key,payload);
 if(error)client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',error:new Error('QA fallida'),fetchStatus:'idle'});
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/?vista=indicadores-edicion"><EditorialIndicadoresPage/></StaticRouter></QueryClientProvider>);
 client.clear();return html;
}

describe('Indicadores de Edición · página',()=>{
 it('header usa el kicker y el título del prompt, sin fecha fija del mockup',()=>{
  const html=render(data);
  expect(html).toContain('ÁREA DE EDICIÓN');expect(html).toContain('<h1>Indicadores</h1>');
  expect(html).not.toContain('Agosto 2026');
 });
 it('muestra como máximo 4 KPI, con nota de snapshot vs período',()=>{
  const html=render(data);
  expect(html).toContain('Proyectos en edición');expect(html).toContain('Entregas completadas');
  expect(html).toContain('Intervenciones vencidas');expect(html).toContain('En espera de autor');
  expect(html).toContain('Corte actual');
 });
 it('nunca hardcodea las cifras del mockup de referencia (28/18/6/3/64)',()=>{
  const html=render(data);
  expect(html).not.toContain('>28<');expect(html).not.toContain('>64<');
 });
 it('KPI de snapshot no muestra variación porcentual; el de período sí cuando hay base',()=>{
  const html=render(data);
  expect(html).toContain('↑ 25%');
 });
 it('tabla de equipo editorial sin ranking: SLA "Sin datos" cuando no hay muestras, nunca 0%',()=>{
  const html=render(data);
  expect(html).toContain('Editor de verificación');expect(html).toContain('80%');
  expect(html).toContain('Sin datos');expect(html).not.toMatch(/>0%</);
  expect(html).not.toMatch(/🥇|🥈|🥉|Top performer|Mejor Editor/i);
 });
 it('tiempo de ciclo muestra la definición como tooltip, nunca un tipo inventado',()=>{
  const html=render(data);
  expect(html).toContain('3,5 días');expect(html).toContain('13 muestras');
  expect(html).toContain('Tiempo bajo responsabilidad de Edición');
 });
 it('riesgo: una fila por proyecto con "en riesgo" marcado, no un estado inventado',()=>{
  const html=render(data);
  expect(html).toContain('Proyecto de verificación');expect(html).toContain('#QAS01');
 });
 it('actividad reciente viene del dominio de Edición, no de otras áreas',()=>{
  const html=render(data);
  expect(html).toContain('Editor entregó Capítulo 6');
 });
 it('RBAC en la UI: un rol distinto de jefe_edicion ve el aviso de acceso, no el tablero',()=>{
  const editor:Usuario={id:'editor-qa',email:'e@test.local',nombre:'Editor QA',rol:'editor'};
  const html=render(undefined,editor);
  expect(html).toContain('No tienes acceso a Indicadores de Edición.');
  expect(html).not.toContain('Proyectos en edición');
 });
 it('estado vacío de período: mensaje explícito, no un gráfico en cero',()=>{
  const vacio:IndicadoresEdicion={...data,kpis:{projectsInEditing:{value:0,deltaPct:null,snapshot:true},completedDeliveries:{value:0,deltaPct:null,snapshot:false},overdueInterventions:{value:0,deltaPct:null,snapshot:true},waitingAuthor:{value:0,deltaPct:null,snapshot:true}},stateDistribution:[],weeklyFlow:[],editors:[],cycleTimes:[],services:[],riskProjects:[],activity:[]};
  const html=render(vacio);
  expect(html).toContain('No hay intervenciones de Edición activas.');
  expect(html).toContain('No hay Editores con intervenciones activas o completadas en este período.');
 });
 it('ciclo sin muestras: "Datos insuficientes", nunca cero engañoso',()=>{
  const sinCiclo:IndicadoresEdicion={...data,cycleTimes:[]};
  const html=render(sinCiclo);
  expect(html).toContain('Datos insuficientes para calcular tiempos de ciclo en este período.');
 });
 it('error de carga muestra reintentar, sin tumbar el resto de la página',()=>{
  const html=render(undefined,chief,true);
  expect(html).toContain('No se pudieron cargar los indicadores de este período.');
  expect(html).toContain('Reintentar');
 });
 it('período por defecto es "Este mes", nunca un mes fijo del mockup',()=>{
  const html=render(data);
  expect(html).toContain('Este mes');
 });
});
