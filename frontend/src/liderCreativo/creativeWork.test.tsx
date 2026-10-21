import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {CreativeWorkInbox} from './CreativeWorkInbox';
import {creativeWorkFilters,creativeWorkRoute} from './creativeWorkRoutes';
import type {CreativeWorkItem,CreativeWorkPage} from '../../../shared/creativeLeader';
vi.stubGlobal('React',React);
const item:CreativeWorkItem={id:'work-1',workItemId:'work-1',creativeProcessId:'process-1',projectId:'project-1',project:{id:'project-1',code:'QA',title:'Libro de prueba',authors:'Autora de prueba',service:'Servicio real',specialist:null,coverUrl:null},type:'BRIEF',group:'BRIEF',label:'Elaborar brief creativo',cta:'Preparar brief',context:'Reunión disponible',state:'Pendiente',waitingOn:null,actionable:true,serviceId:'service-1',dueAt:null,overdue:false,dueToday:false,createdAt:'2026-10-21',updatedAt:'2026-10-21'};
const data=(items:CreativeWorkItem[]):CreativeWorkPage=>({items,total:items.length,page:1,pageSize:10,updatedAt:'2026-10-21',counts:{all:items.length,types:{BRIEF:items.length,CONCEPT:0,RESOURCES:0,COVER_REVIEW:0},states:{Pendiente:items.length},services:[],overdue:0,actionable:items.filter(i=>i.actionable).length,requests:0}});
function render(page:CreativeWorkPage|undefined,url='/?vista=mi-trabajo',error=false){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});client.setQueryData(['auth','me'],{id:'leader',rol:'lider_creativo'});
 const key=['creative-leader','leader','work',creativeWorkFilters(new URL(url,'http://local').searchParams)];
 if(page)client.setQueryData(key,page);
 if(error){const query=client.getQueryCache().build(client,{queryKey:key});query.setState({status:'error',error:new Error('Consulta fallida'),fetchStatus:'idle'});}
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><CreativeWorkInbox/></StaticRouter></QueryClientProvider>);client.clear();return html;
}
describe('Mi trabajo · presentación y rutas',()=>{
 it('renderiza categorías reales, fila, estado, CTA y paginación sin creación manual',()=>{const html=render(data([item]));expect(html).toContain('Libro de prueba');expect(html).toContain('Preparar brief');expect(html).toContain('Filas por página');expect(html).toContain('Tipo de intervención');expect(html).not.toMatch(/Nueva solicitud|Nueva tarea|Crear trabajo|Prioridad/);});
 it('waiting muestra consulta sin CTA primaria ni fechas vencidas',()=>{const html=render(data([{...item,actionable:false,state:'Esperando RRPP',waitingOn:'RRPP',cta:'Ver proceso',context:'Esperando revisión de RRPP.'}]));expect(html).toContain('Ver proceso');expect(html).not.toContain('class="cw-action"');expect(html).not.toContain('Preparar brief');});
 it('vacío real y vacío filtrado tienen mensajes y recuperación distintos',()=>{expect(render(data([]))).toContain('No tienes trabajo creativo pendiente.');const filtered=render(data([]),'/?vista=mi-trabajo&amp;tipo=BRIEF'.replace('&amp;','&'));expect(filtered).toContain('Sin resultados con estos filtros.');expect(filtered).toContain('Limpiar filtros');});
 it('carga usa skeletons y fallo local permite reintentar',()=>{expect(render(undefined)).toContain('Cargando tareas creativas');const html=render(undefined,'/?vista=mi-trabajo',true);expect(html).toContain('Reintentar');expect(html).toContain('No se pudo cargar tu trabajo.');});
 it('conserva filtros al volver, enlaza proceso/work item/concepto y elimina acciones en espera',()=>{
  const path=creativeWorkRoute({...item,type:'CONCEPT_ADJUSTMENT',conceptId:'concept-1'},'/?vista=mi-trabajo&tipo=CONCEPT&pagina=2');const params=new URL(path,'http://local').searchParams;
  expect(params.get('volver')).toBe('/?vista=mi-trabajo&tipo=CONCEPT&pagina=2');expect(params.get('workItem')).toBe('work-1');expect(params.get('trabajo')).toBe('process-1');expect(params.get('concepto')).toBe('concept-1');expect(params.get('accion')).toBe('CONCEPT_ADJUSTMENT');
  const waiting=new URL(creativeWorkRoute({...item,actionable:false},'/?vista=mi-trabajo&accion=BRIEF&concepto=old'),'http://local');expect(waiting.searchParams.has('accion')).toBe(false);expect(waiting.searchParams.has('concepto')).toBe(false);
 });
});
