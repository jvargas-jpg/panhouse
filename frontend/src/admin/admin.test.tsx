import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {StaticRouter} from 'react-router-dom/server';
import {Route,Routes} from 'react-router-dom';
import {describe,it,expect,vi} from 'vitest';
import {AdminApp} from './AdminApp';
import {ActionDialog,SafeLink} from './AdminUi';
import {AccountFields,AuthorSelector} from './AdminPeople';
import {ADMIN_SECTIONS,type AdminHealth,type AdminProject,type AdminWork} from '../../../shared/admin';
vi.stubGlobal('React',React);
const admin={id:'admin-qa',rol:'admin',nombre:'Administración de prueba',email:'admin@example.test'};
const work:AdminWork={id:'work-qa',projectId:'project-qa',type:'edicion',label:'Revisar capítulo inicial',phase:'Edición',state:'en_progreso',status:'En curso',responsible:'Editor de prueba',assignmentId:'assignment-qa',userId:'editor-qa',deadline:'2026-10-30T12:00:00Z',waiting:null,blocked:false,overdue:false,gate:null,updatedAt:'2026-10-28T12:00:00Z',version:'2026-10-28T12:00:00.000Z',canReopen:false,reopenReason:'Hay una entrega registrada'};
const project:AdminProject={id:'project-qa',code:'QA-01',title:'Proyecto editorial de prueba',authors:'Autor de prueba',service:'Edición integral',serviceId:'service-qa',state:'en_proceso',specialist:'Especialista de prueba',specialistId:'specialist-qa',express:false,target:null,updatedAt:'2026-10-28T12:00:00Z',blocked:false,overdue:false,missingOwner:false,inconsistent:false,workspaceStatus:'NOT_CONFIGURED',works:[work,{...work,id:'parallel-qa',type:'direccion_creativa',label:'Definir propuesta de cubierta',responsible:'Líder Creativo de prueba'},{...work,id:'chapter-qa',label:'Revisar segundo capítulo'}]};
const page={items:[project],total:31,page:2,pages:4,columns:[{id:'edicion',label:'Edición'},{id:'direccion_creativa',label:'Dirección creativa'}],options:{services:[],specialists:[]}};
const health:AdminHealth={checkedAt:'2026-10-28T12:00:00Z',application:{status:'responding',uptime:120},postgres:{status:'connected',latencyMs:3,total:2,idle:1,waiting:0},redis:{status:'unavailable',latencyMs:null},queues:[],migrations:{applied:96,latest:'2026-10-28',pending:[],status:'up_to_date'},backups:{status:'not_monitored',message:'No existe monitor de copias de seguridad'}};
type Seed=(cache:QueryClient,put:(path:string,data:unknown)=>void)=>void;
function render(url='/admin/inicio',seed?:Seed,role='admin'){
 const cache=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
 cache.setQueryData(['auth','me'],{...admin,rol:role});
 const put=(path:string,data:unknown)=>cache.setQueryData(['admin',admin.id,path],data);seed?.(cache,put);
 const html=renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location={url}><Routes><Route path="/admin/*" element={<AdminApp/>}/></Routes></StaticRouter></QueryClientProvider>);cache.clear();return html;
}
describe('Administración · presentación y estados de consulta',()=>{
 it.each(ADMIN_SECTIONS)('monta la sección %s dentro del shell oficial',section=>{
  const html=render('/admin/'+section);expect(html).toContain('/brand/panhouse-logo.webp');expect(html).toContain('Historias que conectan.');expect(html).toContain('aria-current="page"');expect(html).toContain('Abrir navegación administrativa');expect(html).not.toContain('href="#"');
 });
 it('Dirección no obtiene acceso por reutilizar la navegación administrativa',()=>{const html=render('/admin/inicio',undefined,'direccion');expect(html).toContain('Acceso restringido');expect(html).not.toContain('admin-shell');});
 it('Inicio no presenta ceros inventados mientras carga ni presencia en línea',()=>{const html=render();expect(html).toContain('—');expect(html).toContain('no es presencia en línea');expect(html).toContain('role="status"');});
 it('Inicio conserva el contexto operativo si falla el diagnóstico secundario',()=>{
  const html=render('/admin/inicio',(c,put)=>{put('/inicio',{active:13,attention:1,blocked:0,overdue:0,blockingRequests:0,recentUsers:2,items:[{...project,missingOwner:true}]});c.getQueryCache().build(c,{queryKey:['admin',admin.id,'/salud']}).setState({status:'error',error:new Error('Diagnóstico no disponible'),fetchStatus:'idle'});});
  expect(html).toContain(project.title);expect(html).toContain('Responsable pendiente o inactivo');expect(html).toContain('Diagnóstico no disponible');expect(html).toContain('Reintentar');
 });
 it('Pipeline muestra procesos paralelos y conserva las tareas del mismo tipo',()=>{
  const html=render('/admin/pipeline?page=2&pageSize=10',(_,put)=>put('/pipeline?page=2&pageSize=10',page));expect(html).toContain('Dirección creativa');expect(html).toContain('2 tareas');expect(html).toContain('1 tarea');expect(html).toContain('31 resultados');expect(html).toContain('2 / 4');expect(html).toContain('back=');expect(html).not.toContain('100%');
 });
 it('lista de proyectos vacía explica el resultado sin inventar proyectos',()=>{
  const html=render('/admin/proyectos',(_,put)=>put('/proyectos?',{...page,items:[],total:0,page:1,pages:1}));expect(html).toContain('No hay proyectos registrados');expect(html).not.toContain(project.title);
 });
 it('Project 360 mantiene tabs, contexto y regreso a los filtros originales',()=>{
  const html=render('/admin/proyectos/project-qa?back=%2Fadmin%2Fpipeline%3Fblocked%3Dtrue',(_,put)=>put('/proyectos/project-qa',project));for(const label of ['Resumen','Procesos','Equipo','Ficha','Archivos','Solicitudes','Actividad','Auditoría'])expect(html).toContain(label);expect(html).toContain('/admin/pipeline?blocked=true');expect(html).toContain(project.title);
 });
 it('el panel de tarea muestra responsable, espera, gate y ausencia de reapertura segura',()=>{
  const html=render('/admin/pipeline?work=work-qa',(_,put)=>put('/work-items/work-qa',{project,work:{...work,blocked:true,gate:'GATE-07',waiting:'Autor'}}));for(const label of ['Editor de prueba','Autor','GATE-07','Hay una entrega registrada','Tareas del mismo proceso'])expect(html).toContain(label);expect(html).not.toContain('Reabrir cierre sin entrega');
 });
 it('equipo histórico permite inspeccionar una tarea sin ofrecer su reasignación',()=>{
  const html=render('/admin/proyectos/project-qa?tab=equipo',(_,put)=>{put('/proyectos/project-qa',project);put('/proyectos/project-qa/equipo?page=1&pageSize=25',{items:[{id:'history-qa',projectId:project.id,userId:'old-editor',name:'Editor anterior',type:'editor',workItemId:work.id,from:'2026-01-01T12:00:00Z',to:'2026-02-01T12:00:00Z',reason:'Reasignación documentada'}],total:1,page:1,pages:1});});expect(html).toContain('Inspeccionar tarea');expect(html).toContain('/admin/pipeline?work=work-qa');expect(html).not.toContain('>Reasignar');
 });
 it('equipo distingue referencias antiguas de historia y ofrece reparar solo contradicciones',()=>{
  const html=render('/admin/proyectos/project-qa?tab=equipo',(_,put)=>{put('/proyectos/project-qa',project);put('/proyectos/project-qa/equipo?page=1&pageSize=25',{items:[{id:'legacy:project-qa:editor',projectId:project.id,userId:'old-editor',name:'Editor anterior',type:'editor',workItemId:null,from:null,to:null,reason:null,legacy:true,canReassign:true,referenceInconsistent:false},{id:'canonical-qa',projectId:project.id,userId:'designer-qa',name:'Diseñador actual',type:'disenador',workItemId:null,from:'2026-01-01T12:00:00Z',to:null,reason:null,legacy:false,canReassign:true,referenceInconsistent:true}],total:2,page:1,pages:1});});
  expect(html).toContain('Referencia guardada');expect(html).toContain('Sin fecha de asignación registrada');expect(html.match(/>Reparar referencia</g)).toHaveLength(1);expect(html).toContain('Reasignar');
 });
 it('sesiones distinguen la sesión actual de presencia y permiten revocación pública',()=>{
  const html=render('/admin/personas?tab=sesiones',(_,put)=>put('/sesiones?page=1&pageSize=25&search=',{items:[{id:'public-id',maskedId:'…12345678',userId:admin.id,name:admin.nombre,role:'admin',state:'valid',current:true,loginAt:'2026-10-28T12:00:00Z',lastActivity:null,expiresAt:'2026-11-01T12:00:00Z',ip:'127.0.0.1',userAgent:'Windows',revokedAt:null,revokeReason:null,viewAs:null}],total:1,page:1,pages:1}));expect(html).toContain('Esta sesión');expect(html).toContain('Revocar');expect(html).toContain('No indica que el usuario esté en línea');expect(html).not.toContain('passwordHash');
 });
 it('salud presenta fallos y backup sin monitor sin declararlos sanos',()=>{const html=render('/admin/salud',(_,put)=>put('/salud',health));expect(html).toContain('No disponible');expect(html).toContain(health.backups.message);expect(html).not.toContain('Todo funciona correctamente');});
 it('la confirmación requiere motivo, explica impacto y no expone un editor de filas',()=>{
  const html=renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><StaticRouter location="/admin/proyectos"><ActionDialog action={{title:'Reasignar Editor',description:'Se conserva el historial y se notifica a ambas personas.',confirm:'Confirmar reasignación',path:'/proyectos/project-qa/reasignar',payload:()=>({})}} onClose={()=>{}}/></StaticRouter></QueryClientProvider>);expect(html).toContain('minLength="10"');expect(html).toContain('Motivo de la intervención');expect(html).toContain('Se conserva el historial');expect(html).not.toContain('name="id"');
 });
 it('enlaces documentales rechazan protocolos ejecutables y credenciales incrustadas',()=>{
  for(const href of ['javascript:alert(1)','https://user:secret@example.test/file'])expect(renderToStaticMarkup(<SafeLink href={href}>Documento</SafeLink>)).not.toContain('<a');expect(renderToStaticMarkup(<SafeLink href="https://drive.google.com/file/d/known/view">Documento</SafeLink>)).toContain('rel="noreferrer"');
 });
 it('el alta incluye Autor y exige elegir un registro canónico mediante búsqueda',()=>{
  const cache=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity,gcTime:Infinity}}});cache.setQueryData(['auth','me'],admin);
  const html=renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location="/admin/personas"><form><AccountFields/><AuthorSelector/></form></StaticRouter></QueryClientProvider>);cache.clear();
  expect(html).toContain('value="autor"');expect(html).toMatch(/<select[^>]*name="authorId"[^>]*required/);expect(html).toContain('Selecciona un autor registrado');expect(html).toContain('no crea otro registro');expect(html).not.toMatch(/<input[^>]*name="authorId"/);
 });
});
