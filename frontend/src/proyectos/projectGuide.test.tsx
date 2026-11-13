import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SpecialistSidebarNav } from '../layout/RoleProjectNavigation';
import { JefaturaSidebar } from '../jefatura/JefaturaSidebar';
import { ProjectPortfolioRow } from './ProjectPortfolio';
import { OperationHomeContent } from './OperationHomePage';
import type { OperationHome } from '../../../shared/operationHome';
import { ProjectGuide } from './ProjectGuide';
import type { ProjectCommandCenter } from '../../../shared/projectCommandCenter';
import type { GuidedProjectSummary } from '../../../shared/projectPortfolio';
vi.stubGlobal('React',React);
vi.mock('../auth/useAuth',()=>({useMe:()=>({data:{id:'spec',rol:'especialista'}})}));
vi.mock('./CommandCenterProceso',()=>({CommandCenterProceso:({especialista}:{especialista:boolean})=><p>{especialista?'Operación autorizada':'Consulta del proceso'}</p>}));
vi.mock('../portalAutor/AuthorWorkflowPanel',()=>({AuthorWorkflowPanel:()=>null}));
function render(component: React.ReactElement, location='/') {
 const client=new QueryClient();
 const html=renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={location}>{component}</StaticRouter></QueryClientProvider>);
 client.clear();return html;
}
const summary:GuidedProjectSummary={id:'one',title:'Libro QA',authors:'Autora QA',code:'EF-QA',service:'Escritura Fantasma',specialist:'Elena',macroState:'en_proceso',alert:null,overdue:false,dueAt:'2026-11-13',actionable:true,mainProcess:null,parallelProcesses:[],risks:[],nextMilestones:[],newAssignment:null};
function data(supervise=false):ProjectCommandCenter {
 return {
  preparacion:{},salud:{especialista:{nombre:'Elena'}},atencion:[],datosEditoriales:{},procesos:[],
  guide:{mode:supervise?'supervise':'operate',editable:!supervise,currentPath:'edicion',position:'Esperando asignación de Jefatura de Edición',nextMilestone:'Asignación de Editor',paths:[{
   id:'edicion',label:'Edición',state:'Esperando tercero',currentStep:'Esperando asignación de Jefatura de Edición',instruction:'Puedes trabajar otro proceso.',responsible:'Jefatura de Edición',waitingFor:'Jefatura de Edición',requirements:[{id:'editor',label:'Editor asignado por Jefatura de Edición',satisfied:false,source:'project_assignments'}],steps:[{id:'editor',label:'Solicitar Editor',completed:false,requirements:[]}],canContinue:false,canOperate:false,requiresAction:false,action:null,historicalReadOnly:supervise,editWarning:null,
  }],finalPackage:{requirements:[],canPrepare:false,prepared:false,canRelease:false,financialSatisfied:false,financialMessage:'No hay solvencia administrativa confirmada.',configurationSource:'unconfirmed'}},
 } as unknown as ProjectCommandCenter;
}
describe('Navegación y guía editorial',()=>{
 it('Especialista ofrece una única sección Proyectos y Solicitudes como seguimiento',()=>{
  const html=render(<SpecialistSidebarNav/>,'/?vista=proyectos');
  expect(html).toContain('Proyectos');expect(html).toContain('Solicitudes');
  expect(html).not.toContain('Mi trabajo');expect(html).not.toContain('Mis proyectos');
  expect(html).toMatch(/<a\b(?=[^>]*aria-current="page")(?=[^>]*href="\/\?vista=proyectos")/);
 });
 it('Jefatura no duplica Seguimiento y los objetivos están bajo Indicadores',()=>{
  const html=render(<JefaturaSidebar vista="indicadores"/>,'/?vista=indicadores&subvista=objetivos');
  expect(html).toContain('Objetivos del mes');expect(html).toContain('vista=indicadores&amp;subvista=objetivos');
  expect(html).not.toContain('vista=seguimiento');expect(html).toContain('Asignaciones y carga');
 });
 it('una espera identifica destinatario, ofrece volver y mantiene Continuar bloqueado',()=>{
  const html=render(<ProjectGuide id="qa" data={data()}/>);
  expect(html).toContain('Esperando a Jefatura de Edición');expect(html).toContain('Trabajar en otro proceso');
  expect(html).toMatch(/disabled="">Continuar/);expect(html).not.toContain('>Solicitar Editor</button>');
 });
 it('supervisión muestra los mismos hechos sin formularios del Especialista',()=>{
  const html=render(<ProjectGuide id="qa" data={data(true)}/>,'/proyectos/qa?proceso=edicion');
  expect(html).toContain('Esperando a Jefatura de Edición');expect(html).toContain('Consultar otros procesos');
  expect(html).not.toContain('<form');expect(html).not.toContain('>Continuar</button>');expect(html).not.toContain('Operación autorizada');
 });
 it('Inicio usa una bandeja de acciones y esperas por proceso, distinta del portafolio',()=>{
  const path=data().guide!.paths[0];
  const home:OperationHome={role:'especialista',summary:{active:1,actionable:1,waiting:1,overdue:0,newAssignments:0},actions:[{project:summary,process:{...path,id:'correccion',currentStep:'Seleccionar Corrector',waitingFor:null},reason:'Corrección disponible en paralelo.',overdue:false,availableElsewhere:0}],waiting:[{project:summary,process:path,reason:'',overdue:false,availableElsewhere:1}],newAssignments:[],risks:[],interventions:[],team:[]};
  const html=render(<OperationHomeContent data={home}/>);
  expect(html).toContain('Tu operación editorial');expect(html).toContain('Nuevos proyectos');expect(html).toContain('Esperando respuestas o entregas');
  expect(html).toContain('href="/proyectos/one?proceso=correccion"');expect(html).toContain('Ver proyecto');expect(html).not.toContain('Responsable ahora');expect(html).not.toContain('Buscar proyectos');
  const portfolio=render(<ProjectPortfolioRow project={{...summary,mainProcess:path,parallelProcesses:[{...path,id:'correccion',label:'Corrección',waitingFor:null,requiresAction:true,state:'Disponible'}]}}/>);
  expect(portfolio).toContain('Proceso principal');expect(portfolio).toContain('Procesos paralelos');expect(portfolio).toContain('Acción disponible');expect(portfolio).toContain('Esperando a Jefatura de Edición');
  expect(portfolio).not.toContain('Responsable ahora');expect(portfolio).not.toContain('Tu operación editorial');
 });
 it('Inicio de Jefatura concentra intervenciones y no reutiliza el portafolio',()=>{
  const home:OperationHome={role:'jefe_area',summary:{active:1,actionable:1,waiting:1,overdue:0,newAssignments:0},actions:[],waiting:[],newAssignments:[],risks:[],interventions:[{id:'a',projectId:'one',title:'Libro QA',kind:'assignment',reason:'Asignar Especialista',href:'/?vista=asignaciones&proyecto=one'}],team:[]};
  const html=render(<OperationHomeContent data={home}/>);
  expect(html).toContain('¿Dónde debo intervenir?');expect(html).toContain('Asignar Especialista');expect(html).toContain('Decisiones que requieren tu intervención');expect(html).toContain('Carga del equipo');
  expect(html).not.toContain('Proceso principal');expect(html).not.toContain('Actividad reciente');expect(html).not.toContain('Registrar envío');
 });
 it('muestra el envío del capítulo dentro del paso sin otra recepción manual',()=>{
  const center=data();center.guide!.paths[0]={...center.guide!.paths[0],waitingFor:null,canOperate:true,requiresAction:true,action:{kind:'chapter_author',chapter:3,label:'Enviar capítulo 3 al Autor'},currentStep:'Enviar capítulo 3 al Autor',delivery:{receivedAt:'2026-11-13T12:00:00Z',url:'https://example.test/chapter',label:'Capítulo 3'}};
  const html=render(<ProjectGuide id="qa" data={center}/>);
  expect(html).toContain('Entrega recibida');expect(html).toContain('Fecha de envío al Autor');expect(html).toContain('Guardar y seguir');expect(html).not.toContain('type="checkbox"');
 });
});
