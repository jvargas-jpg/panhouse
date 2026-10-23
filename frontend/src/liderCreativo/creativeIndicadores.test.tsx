import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {CreativeIndicadoresPage} from './CreativeIndicadoresPage';
import {hoyIndicadoresCreativos,rangoCreativo} from './creativeIndicadoresApi';
import type {IndicadoresCreativos} from '../../../shared/creativeIndicadores';
vi.stubGlobal('React',React);

const periodo={from:'2026-01-01',to:'2026-10-21',anteriorFrom:'2025-03-13',anteriorTo:'2025-12-31',dias:294,zonaHoraria:'America/Caracas',hoy:'2026-10-21'};
const base:IndicadoresCreativos={
 periodo,
 summary:{briefsElaborados:4,conceptosCreados:9,recursosEntregados:2,cubiertasVerificadas:1,comparacionBriefs:null,comparacionConceptos:25.5,comparacionRecursos:null,comparacionCubiertas:null},
 monthly:[{clave:'2026-10',mes:'Oct 26',briefs:4,conceptos:9,recursos:2,cubiertas:1}],
 previousMonthly:[],
 stateDistribution:[{nombre:'Conceptos',cantidad:2,porcentaje:66.7},{nombre:'Completado',cantidad:1,porcentaje:33.3}],
 byService:[{nombre:'Sello editorial',cantidad:3,porcentaje:100}],
 cycleTimes:[
  {id:'brief',etiqueta:'Brief',promedioDias:1.5,muestras:4,nota:''},
  {id:'conceptos',etiqueta:'Conceptos',promedioDias:null,muestras:0,nota:''},
  {id:'recursos',etiqueta:'Recursos',promedioDias:0.5,muestras:2,nota:''},
  {id:'cubierta',etiqueta:'Cubierta',promedioDias:2,muestras:1,nota:''},
 ],
 workload:{activas:3,enEsperaTerceros:2,completadasPeriodo:1},
 milestones:[{id:'hito-1',proyectoId:'proyecto-qa',codigo:'QAI',titulo:'Proyecto indicadores QA',autores:'Autora QA',servicio:'Sello editorial',hito:'Brief finalizado',fecha:'2026-10-20T14:00:00Z'}],
 activity:[{id:'activity-1',at:'2026-10-20T14:00:00Z',label:'El brief está disponible para el Especialista',actor:'Líder QA',projectTitle:'Proyecto indicadores QA',creativeProcessId:'process-qa',href:'/?vista=proyectos-creativos&trabajo=process-qa'}],
 filters:{services:[{id:'service-qa',label:'Sello editorial'}]},
};
function render(data:IndicadoresCreativos|undefined,rol='lider_creativo',error=false){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 client.setQueryData(['auth','me'],{id:'leader',rol});
 const rango=rangoCreativo('ano',hoyIndicadoresCreativos()),key=['creative-leader','leader','indicadores',rango.from,rango.to,''];
 if(data)client.setQueryData(key,data);
 if(error)client.getQueryCache().build(client,{queryKey:key}).setState({status:'error',error:new Error('Consulta QA fallida'),fetchStatus:'idle'});
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/?vista=indicadores"><CreativeIndicadoresPage/></StaticRouter></QueryClientProvider>);
 client.clear();return html;
}
describe('Indicadores de Dirección Creativa · página',()=>{
 it('muestra los 4 KPI con sus valores y "Sin base de comparación" cuando no hay período anterior',()=>{
  const html=render(base);
  expect(html).toContain('Briefs elaborados');expect(html).toContain('Conceptos creados');expect(html).toContain('Recursos entregados');expect(html).toContain('Cubiertas verificadas');
  expect(html).toContain('Sin base de comparación');
  expect(html).not.toMatch(/\+∞|Infinity/);
 });
 it('no usa semántica verde/rojo de progreso en los deltas de volumen',()=>{
  const html=render(base);
  expect(html).not.toContain('text-emerald');expect(html).not.toContain('text-amber-700');expect(html).not.toContain('progressbar');
 });
 it('tiempo de ciclo sin muestras se etiqueta "Datos insuficientes", nunca 0 días falso',()=>{
  const html=render(base);
  expect(html).toContain('Datos insuficientes');
 });
 it('estado actual se presenta como distribución, no como progreso de un solo proyecto',()=>{
  const html=render(base);
  expect(html).toContain('Estado actual de proyectos creativos');
  expect(html).toContain('Conceptos');expect(html).toContain('Completado');
 });
 it('hitos y actividad reciente muestran datos reales del período, sin inventar texto',()=>{
  const html=render(base);
  expect(html).toContain('Brief finalizado');expect(html).toContain('Proyecto indicadores QA');expect(html).toContain('El brief está disponible para el Especialista');
 });
 it('exportar no está presente sin datos cargados (deshabilitado)',()=>{
  const html=render(undefined);
  expect(html).toContain('disabled=""');
  expect(html).toContain('Cargando indicadores');
 });
 it('período vacío: cada sección muestra su propio mensaje, no ceros decorativos',()=>{
  const vacio:IndicadoresCreativos={...base,summary:{briefsElaborados:0,conceptosCreados:0,recursosEntregados:0,cubiertasVerificadas:0,comparacionBriefs:null,comparacionConceptos:null,comparacionRecursos:null,comparacionCubiertas:null},monthly:[{clave:'2026-10',mes:'Oct 26',briefs:0,conceptos:0,recursos:0,cubiertas:0}],stateDistribution:[],byService:[],milestones:[],activity:[],cycleTimes:base.cycleTimes.map(c=>({...c,promedioDias:null,muestras:0}))};
  const html=render(vacio);
  expect(html).toContain('No hay registros de actividad creativa en este período.');
  expect(html).toContain('No hay hitos recientes en este período.');
  expect(html).toContain('No hay actividad creativa reciente.');
 });
 it('error de carga ofrece reintentar sin romper la página',()=>{
  const html=render(undefined,'lider_creativo',true);
  expect(html).toContain('No se pudieron cargar los indicadores de este período.');
  expect(html).toContain('Reintentar');
 });
 it('RBAC: un rol distinto de lider_creativo no ve datos de indicadores',()=>{
  const html=render(base,'especialista');
  expect(html).toContain('No tienes acceso a Indicadores de Dirección Creativa.');
  expect(html).not.toContain('Briefs elaborados');
 });
});
