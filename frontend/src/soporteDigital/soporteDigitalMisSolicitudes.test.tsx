import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe,it,expect,vi } from 'vitest';
import { SoporteDigitalMisSolicitudes } from './SoporteDigitalMisSolicitudes';
import { digitalRequestsKey } from './soporteDigitalRequestsApi';
import type { DigitalRequestDetail,DigitalRequestList,DigitalRequestRow } from '../../../shared/soporteDigitalRequests';
vi.stubGlobal('React',React);
const row:DigitalRequestRow={ id:'request-qa',type:'digital_material',subject:'Comprobar el material recibido',summary:'El material recibido requiere una revisión.',status:'pendiente',version:1,
  workItemId:'work-qa',projectId:'project-qa',projectTitle:'Proyecto editorial de prueba',projectCode:'COD-QA',authors:'Autor de prueba',coverUrl:null,stage:'testing',taskLabel:'Revisar archivos finales para KDP',specialist:'Especialista de prueba',canBlock:true,
  createdAt:'2026-10-28T10:00:00Z',updatedAt:'2026-10-28T10:00:00Z',lastEvent:'Solicitud enviada',requiresAction:false,blocksWorkItem:false,canCancel:true,workAccessible:true };
const list:DigitalRequestList={ items:[row],total:12,page:1,pages:2,counts:{all:12,pending:8,returned:2,resolved:1,cancelled:1},projects:[{id:row.projectId,name:row.projectTitle}] };
const detail:DigitalRequestDetail={ summary:row,description:'Descripción original del problema reportado por el usuario.',destination:'Especialista coordinador',blocker:null,questions:[],attachments:[],canAttach:true,result:null,
  history:[{id:'h1',label:'Solicitud enviada',actor:'Soporte de prueba',at:row.createdAt,text:null}] };
const listKey=[...digitalRequestsKey,'digital-qa','list','tab=all&search=&page=1&pageSize=25'];
const detailKey=[...digitalRequestsKey,'digital-qa','detail',row.id];
function render(seed?:(c:QueryClient) => void,url='/?vista=mis-solicitudes&request=request-qa') {
  const c=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity,gcTime:Infinity}}});
  c.setQueryData(['auth','me'],{id:'digital-qa',rol:'soporte_digital',nombre:'Soporte de prueba',email:'qa@example.test'});
  c.setQueryData(listKey,list); c.setQueryData(detailKey,detail); seed?.(c);
  const html=renderToStaticMarkup(<QueryClientProvider client={c}><StaticRouter location={url}><SoporteDigitalMisSolicitudes /></StaticRouter></QueryClientProvider>); c.clear(); return html;
}
describe('Soporte Digital · Mis solicitudes · interfaz',() => {
  it('usa shell oficial y navegación activa, sin convertir la pantalla en dashboard',() => {
    const h=render(); expect(h).toContain('/brand/panhouse-logo.webp'); expect(h).toContain('Historias que conectan.'); expect(h).toContain('Mis solicitudes'); expect(h).toContain('Solicitudes enviadas por mí');
    expect(h).not.toMatch(/sd-summary-card|recharts|>\d+%<|Prioridad alta/); expect(h).toContain('Nueva solicitud');
  });
  it('una fila por solicitud con tipo, tema, tarea y counts completos del backend',() => {
    const h=render(); expect(h).toContain(row.subject); expect(h).toContain(row.taskLabel); expect(h).toContain(row.projectCode); expect(h).toContain('Todas<span>12</span>'); expect(h).toContain('12 solicitudes');
  });
  it('solicitante puede cancelar, ver contexto y agregar evidencia, nunca resolver su propia solicitud',() => {
    const h=render(); for(const text of ['Cancelar solicitud','Agregar evidencia','Ver tarea relacionada']) expect(h).toContain(text);
    expect(h).not.toContain('Marcar como resuelta'); expect(h).not.toContain('>Responder<'); expect(h).not.toContain('>Editar<'); expect(h).not.toContain('Conversación');
    expect(h).toContain('/?vista=mi-trabajo&amp;workItem=work-qa');
  });
  it('muestra descripción original, etapa al enviar, destinatario y coordinación actuales',() => {
    const h=render(); expect(h).toContain(detail.description); expect(h).toContain('Etapa al enviar'); expect(h).toContain('Especialista coordinador'); expect(h).toContain(row.specialist); expect(h).not.toContain('Asignada a');
  });
  it('requiere información presenta la pregunta y una acción contextual',() => {
    const d:DigitalRequestDetail={...detail,summary:{...row,status:'requiere_informacion',requiresAction:true,version:3},questions:[{id:'q1',text:'Indica la página y el formato que revisaste.',actor:'Especialista de prueba',at:row.updatedAt,answer:null,answeredBy:null,answeredAt:null}]};
    const h=render(c => c.setQueryData(detailKey,d)); expect(h).toContain('Indica la página y el formato'); expect(h).toContain('Completar información'); expect(h).toContain('Enviar información'); expect(h).not.toContain('>Responder<');
  });
  it('la resolución muestra actor, fecha y referencia y deja de ofrecer ediciones',() => {
    const d:DigitalRequestDetail={...detail,summary:{...row,status:'resuelta',canCancel:false,version:2},canAttach:false,result:{text:'Se confirmó el archivo correcto.',actor:'Especialista de prueba',at:row.updatedAt,workItemId:row.workItemId,attachmentId:null,blockerResolved:false}};
    const h=render(c => c.setQueryData(detailKey,d)); expect(h).toContain('Se confirmó el archivo correcto.'); expect(h).toContain('Ver tarea de resultado'); expect(h).not.toContain('Cancelar solicitud'); expect(h).not.toContain('Agregar evidencia');
  });
  it('alerta de bloqueo exige relación explícita, y no se infiere por tipo material',() => {
    expect(render()).not.toContain('Esta solicitud tiene un bloqueo activo');
    const h=render(c => c.setQueryData(detailKey,{...detail,summary:{...row,blocksWorkItem:true,canCancel:false},blocker:{id:'block-qa',active:true,reason:'Confirmar el material requerido',resolvedAt:null}}));
    expect(h).toContain('Esta solicitud tiene un bloqueo activo'); expect(h).not.toContain('Cancelar solicitud');
  });
  it('Archivos muestra evidencia con metadatos y URL autorizada, no un explorador de Drive',() => {
    const h=render(c => c.setQueryData(detailKey,{...detail,attachments:[{id:'file-qa',name:'evidencia-real.pdf',mimeType:'application/pdf',size:2048,at:row.createdAt,uploadedBy:'Soporte de prueba',url:'/api/soporte-digital/solicitudes/request-qa/archivos/file-qa'}]}),'/?vista=mis-solicitudes&request=request-qa&detailTab=files');
    expect(h).toContain('evidencia-real.pdf'); expect(h).toContain('2.0 KB'); expect(h).toContain('/api/soporte-digital/solicitudes/request-qa/archivos/file-qa'); expect(h).not.toContain('drive.google.com/drive/folders'); expect(h).toContain('Adjuntar archivo');
  });
  it('Historial presenta eventos reales con autor y tiempo y no eventos de navegación',() => {
    const h=render(undefined,'/?vista=mis-solicitudes&request=request-qa&detailTab=history'); expect(h).toContain('Solicitud enviada'); expect(h).toContain('Soporte de prueba'); expect(h).not.toContain('Cambió tab');
  });
  it('vacío sin solicitudes mantiene una salida útil a Mi trabajo',() => {
    const h=render(c => c.setQueryData(listKey,{...list,items:[],total:0,counts:{all:0,pending:0,returned:0,resolved:0,cancelled:0}}),'/?vista=mis-solicitudes');
    expect(h).toContain('Aún no has enviado solicitudes.'); expect(h).toContain('Ir a Mi trabajo'); expect(h).not.toContain('No se pudieron cargar');
  });
  it('lista y detalle tienen estados de loading independientes',() => {
    const h=render(c => c.removeQueries({queryKey:detailKey,exact:true})); expect(h).toContain(row.subject); expect(h).toContain('Cargando detalle de solicitud');
    const loading=render(c => c.removeQueries({queryKey:listKey,exact:true})); expect(loading).toContain('Cargando solicitudes'); expect(loading).toContain(detail.description);
  });
  it('error de lista no elimina el detalle de la solicitud seleccionada',() => {
    const h=render(c => c.getQueryCache().build(c,{queryKey:listKey}).setState({status:'error',error:new Error('QA'),fetchStatus:'idle'}));
    expect(h).toContain('Reintentar solicitudes'); expect(h).toContain(detail.description);
  });
  it('crear con deep link conserva tarea y destino sin un selector arbitrario de usuarios',() => {
    const key=[...digitalRequestsKey,'digital-qa','contexts','search=&page=1&pageSize=10&workItemId=work-qa'];
    const h=render(c => c.setQueryData(key,{items:[row],total:1,page:1,pages:1}),'/?vista=mis-solicitudes&create=1&workItemId=work-qa');
    expect(h).toContain('Se enviará a: Especialista coordinador'); expect(h).toContain('Enviar solicitud'); expect(h).toContain('Evidencia (opcional)'); expect(h).not.toContain('destinationUserId'); expect(h).not.toContain('Alta / Media / Baja');
  });
  it('solo hay estados canónicos y filtros útiles, sin prioridades ni chat',() => {
    const h=render(); for(const label of ['Estado','Tipo de solicitud','Proyecto','Fecha de creación desde','Fecha de creación hasta']) expect(h).toContain('aria-label="'+label+'"');
    expect(h).not.toContain('>Abierta<'); expect(h).not.toContain('>Cerrada<'); expect(h).not.toContain('typing');
  });
});
