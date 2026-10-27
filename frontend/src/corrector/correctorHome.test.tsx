import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { CorrectorHomePage } from './CorrectorHomePage';
import type { CorrectorDashboard, CorrectorHomeItem } from '../../../shared/correctorHome';
vi.stubGlobal('React',React);
const item:CorrectorHomeItem={correctionId:'correction-1',workItemId:'work-1',projectId:'project-1',title:'Proyecto editorial de prueba',authors:'Autor de prueba',code:'QA-COH',coverUrl:null,intervention:'Tripa completa',state:'inProgress',stateLabel:'En corrección',deadline:'2026-10-28T10:30:00Z',deadlineState:'proximo_a_vencer',blocker:null,actionable:true,completedAt:null,cta:'Continuar'};
const dashboard:CorrectorDashboard={today:'2026-10-27',monthLabel:'octubre de 2026',summary:{active:1,dueSoon:1,overdue:0,completedThisMonth:0},activeTotal:1,attentionItems:[item],nextDeadline:item,recentCompleted:[]};
function render({data=dashboard,error=false,pending=false}:{data?:CorrectorDashboard;error?:boolean;pending?:boolean}={}){
 const cache=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});cache.setQueryData(['auth','me'],{id:'corrector-1',rol:'corrector',nombre:'Corrector de prueba',email:'corrector@qa.test'});
 if(!pending)cache.setQueryData(['corrector','inicio'],data);
 if(error)cache.getQueryCache().build(cache,{queryKey:['corrector','inicio']}).setState({status:'error',error:Error('QA error'),fetchStatus:'idle'});
 const html=renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location="/"><CorrectorHomePage/></StaticRouter></QueryClientProvider>);cache.clear();return html;
}
describe('Corrector · Inicio · interfaz',()=>{
 it('usa shell PanHouse, logo oficial, título Inicio y navegación mínima real',()=>{const h=render();expect(h).toContain('/brand/panhouse-logo.webp');expect(h).toContain('Navegación del Corrector');expect(h).toContain('Historias que conectan.');expect(h).toContain('>Inicio<');expect(h).toContain('Corrector de prueba');for(const text of ['Mis solicitudes','Mis proyectos','Asignaciones y carga','Productividad','Rating'])expect(h).not.toContain(text);});
 it('cuatro indicadores reales y período de entregadas explícito',()=>{const h=render();for(const label of ['Correcciones activas','Vencen pronto','Vencidas','Entregadas este mes','octubre de 2026'])expect(h).toContain(label);expect((h.match(/class="coh-summary-card /g)||[]).length).toBe(4);expect(h).not.toMatch(/>\s*\d+\s*%/);});
 it('una fila es una intervención con CTA hacia su work item, sin capítulo ficticio',()=>{const h=render();expect(h).toContain('Tripa completa');expect(h).toContain('Autor de prueba');expect(h).toContain('vista=mi-trabajo&amp;workItem=work-1');expect(h).toContain('Continuar: Tripa completa');expect(h).not.toContain('Capítulo');});
 it('estado vacío es compacto y no crea una tabla sin datos',()=>{const h=render({data:{...dashboard,summary:{active:0,dueSoon:0,overdue:0,completedThisMonth:0},activeTotal:0,attentionItems:[],nextDeadline:null}});expect(h).toContain('No tienes correcciones asignadas actualmente.');expect(h).toContain('Cuando recibas una nueva asignación aparecerá aquí.');expect(h).not.toContain('class="coh-table"');expect(h).not.toContain('Continuar mi corrección');});
 it('vencida y plazo próximo usan semántica textual del backend',()=>{const h=render();expect(h).toContain('Vence pronto');const late=render({data:{...dashboard,attentionItems:[{...item,deadlineState:'vencido'}]}});expect(late).toContain('coh-overdue');expect(late).toContain('>Vencida<');});
 it('bloqueo muestra su motivo sin ofrecer una acción de reporte inexistente',()=>{const h=render({data:{...dashboard,attentionItems:[{...item,state:'blocked',stateLabel:'Bloqueada',deadlineState:null,blocker:'Falta el documento de entrada',actionable:false,cta:'Ver trabajo'}],nextDeadline:null}});expect(h).toContain('Falta el documento de entrada');expect(h).toContain('Ver trabajo');expect(h).not.toContain('Reportar bloqueo');});
 it('guía compacta describe los dos archivos y no abre Drive global ni inventa una guía descargable',()=>{const h=render();for(const text of ['control de cambios','informe técnico','Para corregir','Corregido'])expect(h).toContain(text);for(const text of ['Abrir Drive','Ver guía de corrección','Descargar guía'])expect(h).not.toContain(text);});
 it('fecha próxima enlaza a la intervención y la ausencia no elimina el resto del resumen',()=>{expect(render()).toContain('Próxima entrega');const h=render({data:{...dashboard,nextDeadline:null}});expect(h).toContain('No tienes próximas entregas con fecha registrada.');expect(h).toContain('Proyecto editorial de prueba');});
 it('entregadas quedan fuera de atención y conservan enlace a la entrega',()=>{const h=render({data:{...dashboard,recentCompleted:[{...item,workItemId:'done-1',state:'completed',stateLabel:'Entregada',completedAt:'2026-10-20',cta:'Ver entrega'}]}});expect(h).toContain('coh-completed');expect(h).toContain('vista=mi-trabajo&amp;workItem=done-1');expect(h).toContain('Ver entrega');});
 it('loading y error permiten recuperar el dashboard sin spinner de pantalla completa',()=>{expect(render({pending:true})).toContain('Cargando tus correcciones');const h=render({error:true});expect(h).toContain('No se pudo cargar tu Inicio');expect(h).toContain('Reintentar');expect(h).toContain('/brand/panhouse-logo.webp');});
});
