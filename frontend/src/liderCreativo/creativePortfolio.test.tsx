import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {CreativePortfolioPage,CreativeQuickViewContent} from './CreativePortfolioPage';
import {creativePortfolioFilters,portfolioWorkRoute} from './creativePortfolioRoutes';
import type {CreativePortfolioPage as PortfolioPage,CreativeProjectSummary,CreativeProjectDetail} from '../../../shared/creativePortfolio';
vi.stubGlobal('React',React);
const summary:CreativeProjectSummary={projectId:'project-qa',creativeProcessId:'process-qa',rootProcessId:'process-qa',project:{id:'project-qa',code:'QA',title:'Proyecto creativo de prueba',authors:'Autora QA',service:'Servicio de catálogo',specialist:'Especialista QA',coverUrl:null},service:{id:'service-qa',code:'CAT',name:'Servicio de catálogo'},specialist:{id:'specialist-qa',name:'Especialista QA'},creativeState:'BRIEF',stateLabel:'Brief',stateDetail:'Brief en elaboración',waitingOn:null,nextStep:'Finalizar el brief creativo.',currentDeadline:null,lastActivity:{id:'event-qa',at:'2026-10-21T14:00:00Z',label:'Se registró la reunión creativa',actor:'Líder QA'},currentWorkItem:{workItemId:'work-qa',creativeProcessId:'process-qa',type:'BRIEF',cta:'Preparar brief'},conceptSummary:{total:0,approved:0},resourceSummary:{image:false,pdf:false},coverStatus:null};
const detail:CreativeProjectDetail={summary,concepts:[],resources:[],activity:[summary.lastActivity!],workspace:{rootUrl:null,designUrl:null},brief:{url:null,approvedAt:null},cover:null};
const page=(items:CreativeProjectSummary[]):PortfolioPage=>({items,total:items.length,page:1,pageSize:10,updatedAt:'2026-10-21',counts:{all:items.length,stages:{BRIEF:items.length},services:[{id:'service-qa',label:'Servicio de catálogo',count:items.length}],specialists:[{id:'specialist-qa',label:'Especialista QA',count:items.length}],actionable:items.filter(i=>i.currentWorkItem).length,requests:0}});
function render(data:PortfolioPage|undefined,url='/?vista=proyectos-creativos',selectedDetail:CreativeProjectDetail|undefined=undefined,failure?:'list'|'detail'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});client.setQueryData(['auth','me'],{id:'leader',rol:'lider_creativo'});
 const params=new URL(url,'http://local').searchParams,listKey=['creative-leader','leader','portfolio',creativePortfolioFilters(params)],detailKey=['creative-leader','leader','project-detail',params.get('selectedProject')];
 if(data)client.setQueryData(listKey,data);if(selectedDetail)client.setQueryData(detailKey,selectedDetail);
 if(failure)client.getQueryCache().build(client,{queryKey:failure==='list'?listKey:detailKey}).setState({status:'error',error:new Error('Consulta QA fallida'),fetchStatus:'idle'});
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><CreativePortfolioPage/></StaticRouter></QueryClientProvider>);client.clear();return html;
}
function renderDetail(data:CreativeProjectDetail){return renderToStaticMarkup(<StaticRouter location="/?vista=proyectos-creativos"><CreativeQuickViewContent data={data} returnTo="/?vista=proyectos-creativos&selectedProject=project-qa" onConcept={()=>{}}/></StaticRouter>);}
describe('Proyectos creativos · master-detail y presentación',()=>{
 it('renderiza seis columnas, filtros y fila seleccionable por teclado, sin crear proyectos',()=>{
  const html=render(page([summary]),'/?vista=proyectos-creativos&selectedProject=project-qa',detail);expect(html).toContain('Última actividad');expect(html).toContain('Siguiente paso');expect(html).toContain('Especialista coordinador');expect(html).toContain('tabindex="0" aria-selected="true"');expect(html).toContain('Ver detalle de Proyecto creativo de prueba');expect(html).not.toMatch(/Nuevo proyecto|Nueva solicitud|Nuevo proyecto creativo/);
 });
 it('categorías muestran counts de proyectos y el resumen no inventa progreso numérico',()=>{const html=render(page([summary]));expect(html).toContain('Todos');expect(html).toContain('Completados');expect(html).toContain('Servicio de catálogo (1)');expect(html).not.toMatch(/progressPercent|\d de 5|\d\/5|\d%/);});
 it('panel creativo muestra estado, siguiente paso, recursos vacíos y actividad real',()=>{const html=renderDetail(detail);expect(html).toContain('Finalizar el brief creativo.');expect(html).toContain('Aún no hay recursos entregados.');expect(html).toContain('Se registró la reunión creativa');expect(html).toContain('Espacio documental no disponible.');expect(html).not.toContain('OAuth');expect(html).toContain('aria-current="step"');});
 it('waiting RRPP, autor y Diseño conservan consulta y ocultan CTA de operación del Líder',()=>{for(const waitingOn of ['RRPP','AUTHOR','DESIGN'] as const){const html=renderDetail({...detail,summary:{...summary,waitingOn,currentWorkItem:null,stateDetail:'Esperando revisión',nextStep:'Debe continuar el responsable actual.'}});expect(html).not.toContain('class="cp-primary-action"');expect(html).not.toContain('Preparar brief');expect(html).toContain('Debe continuar el responsable actual.');}});
 it('conceptos reales muestran metadata; PDF usa placeholder y nunca un embed o descarga para preview',()=>{
  const concept={id:'concept-qa',descripcion:'Concepto documentado',enlace:'https://example.test/concept.pdf',estado:'Pendiente RRPP',fechaAprobadaRrpp:null,fechaEnviadaAutor:null,fechaAprobadaAutor:null,feedbackRrpp:null,feedbackAutor:null,thumbnailUrl:null,statusLabel:'Esperando RRPP',approved:false};
  let html=renderDetail({...detail,concepts:[concept]});expect(html).toContain('Ver concepto 1: Concepto documentado');expect(html).toContain('Vista previa no disponible');expect(html).toContain('Esperando RRPP');expect(html).not.toMatch(/<iframe|<embed|<object/);
  html=renderDetail({...detail,concepts:[{...concept,enlace:'https://example.test/concept.png',thumbnailUrl:'https://example.test/concept.png'}]});expect(html).toContain('src="https://example.test/concept.png"');
 });
 it('recursos y Drive usan URLs persistidas como enlaces secundarios',()=>{const html=renderDetail({...detail,resources:[{type:'CONCEPT_PDF',label:'Concepto aprobado en PDF',conceptId:'concept-qa',url:'https://docs.google.com/document/d/existing/edit',submittedAt:null}],workspace:{rootUrl:'https://drive.google.com/drive/folders/root-id',designUrl:'https://drive.google.com/drive/folders/design-id'}});expect(html).toContain('Carpeta de Diseño');expect(html).toContain('href="https://drive.google.com/drive/folders/design-id"');expect(html).toContain('Concepto aprobado en PDF');expect(html).not.toContain('Aún no hay recursos entregados.');});
 it('vacío real y filtrado, skeletons de lista y detalle tienen estados propios',()=>{expect(render(page([]))).toContain('No tienes proyectos creativos activos.');expect(render(page([]),'/?vista=proyectos-creativos&creativeState=CONCEPTS')).toContain('No hay proyectos con estos filtros.');expect(render(undefined)).toContain('Cargando proyectos creativos');expect(render(page([summary]),'/?vista=proyectos-creativos&selectedProject=project-qa')).toContain('Cargando detalle creativo');});
 it('fallos de lista y detalle son independientes y ofrecen retry contextual',()=>{
  let html=render(undefined,'/?vista=proyectos-creativos&selectedProject=project-qa',detail,'list');expect(html).toContain('Reintentar proyectos');expect(html).toContain('Finalizar el brief creativo.');
  html=render(page([summary]),'/?vista=proyectos-creativos&selectedProject=project-qa',undefined,'detail');expect(html).toContain('Reintentar detalle');expect(html).toContain('Ver detalle de Proyecto creativo de prueba');
 });
 it('ruta de acción conserva selección/filtros y apunta al work item real, sin ir a Ficha',()=>{
  const original='/?vista=proyectos-creativos&creativeState=CONCEPTS&page=2&selectedProject=project-qa';const route=portfolioWorkRoute({...summary.currentWorkItem!,type:'CONCEPT_ADJUSTMENT',conceptId:'concept-qa'},summary.projectId,original),params=new URL(route,'http://local').searchParams;
  expect(params.get('volver')).toBe(original);expect(params.get('selectedProject')).toBe('project-qa');expect(params.get('workItem')).toBe('work-qa');expect(params.get('concepto')).toBe('concept-qa');expect(params.get('accion')).toBe('CONCEPT_ADJUSTMENT');expect(route).not.toContain('ficha');
  expect(creativePortfolioFilters(params)).toEqual({creativeState:'CONCEPTS',page:2});
 });
});
