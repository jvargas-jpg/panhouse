import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SoporteEditorialMisSolicitudes } from './SoporteEditorialMisSolicitudes';
import { qualityRequestsKey } from './soporteEditorialRequestsApi';
import type { QualityRequestDetail, QualityRequestList, QualityRequestRow } from '../../../shared/soporteEditorialRequests';
vi.stubGlobal('React', React);
const row: QualityRequestRow = {
  id: 'request-1', type: 'calidad_material', subject: 'Confirmar el PDF recibido', status: 'pendiente', version: 1,
  projectId: 'project-1', projectCode: 'QA-CAL-01', projectTitle: 'Proyecto editorial de prueba', authors: 'Autor de prueba', coverUrl: null,
  qualityPhaseId: 'phase-1', workItemId: 'work-1', phase: 2, round: 2, versionLabel: 'V3',
  requestedAt: '2026-10-28T12:00:00Z', updatedAt: '2026-10-28T12:00:00Z', lastEvent: 'Solicitud enviada', requiresAction: false, canCancel: true, workAccessible: true,
};
const list: QualityRequestList = { items: [row], total: 1, pages: 1, page: 1, counts: { all: 1, pending: 1, returned: 0, resolved: 0, cancelled: 0 }, projects: [{ id: row.projectId, name: row.projectTitle }] };
const detail: QualityRequestDetail = { summary: row, description: 'La versión recibida no corresponde al material diagramado de esta ronda.', destination: 'Especialista coordinador', specialist: 'Especialista de prueba', designer: 'Diseñador de prueba', questions: [], history: [{ id: 'event-1', label: 'Solicitud enviada', actor: 'Validador de prueba', at: row.requestedAt, text: null }], result: null, cancellation: null };
const listKey = [...qualityRequestsKey, 'support-1', 'list', 'tab=all&search=&page=1&pageSize=25'];
const detailKey = [...qualityRequestsKey, 'support-1', 'detail', row.id];
function render(seed: (cache: QueryClient) => void, url = '/?vista=mis-solicitudes&request=request-1') {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  cache.setQueryData(['auth', 'me'], { id: 'support-1', rol: 'soporte_editorial', nombre: 'Validador de prueba' });
  seed(cache);
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location={url}><SoporteEditorialMisSolicitudes /></StaticRouter></QueryClientProvider>);
  cache.clear(); return html;
}
describe('Soporte Editorial · Mis solicitudes · interfaz', () => {
  it('outbox por solicitud con shell oficial, fases/rondas y versión independientes', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    for (const text of ['Mis solicitudes', '/brand/panhouse-logo.webp', 'Historias que conectan.', 'Confirmar el PDF recibido', 'Ronda 2', 'V3', 'Especialista coordinador', 'Requieren tu acción']) expect(html).toContain(text);
    expect(html).not.toContain('ec-kpi'); expect(html).not.toContain('Mensajes'); expect(html).not.toContain('Archivos ('); expect(html).not.toContain('Prioridad');
    expect(html).not.toContain('Marcar Resuelta'); expect(html).not.toContain('Resolver con respuesta');
  });
  it('detalle conserva descripción y permite volver a la ronda, no al proyecto completo', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).toContain(detail.description); expect(html).toContain('workItem=phase-1'); expect(html).toContain('Ver validación');
    expect(html).not.toContain('/proyectos/project-1');
  });
  it('request devuelta muestra pregunta, actor y completar información sobre el mismo ID', () => {
    const returned: QualityRequestDetail = { ...detail, summary: { ...row, status: 'requiere_informacion', requiresAction: true }, questions: [{ id: 'question-1', text: 'Indica la página afectada.', actor: 'Especialista de prueba', at: row.updatedAt, answer: null, answeredBy: null, answeredAt: null }] };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [returned.summary] }); c.setQueryData(detailKey, returned); });
    expect(html).toContain('Se necesita más información'); expect(html).toContain('Indica la página afectada.'); expect(html).toContain('Completar información'); expect(html).toContain('Enviar información');
    expect(html).not.toContain('Editar solicitud');
  });
  it('resuelta muestra resolución, responsable, fecha y referencias sin formulario editable', () => {
    const resolved: QualityRequestDetail = { ...detail, summary: { ...row, status: 'resuelta', canCancel: false }, result: { text: 'Se confirmó el enlace correcto de V3.', actor: 'Especialista de prueba', at: row.updatedAt, references: row } };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [resolved.summary] }); c.setQueryData(detailKey, resolved); });
    expect(html).toContain('Resultado'); expect(html).toContain('Se confirmó el enlace correcto de V3.'); expect(html).toContain('Ver validación del resultado');
    expect(html).not.toContain('Cancelar solicitud'); expect(html).not.toContain('Enviar información');
  });
  it('cancelada conserva motivo y actor de cancelación, sin eliminar ni editar', () => {
    const cancelled = { ...detail, summary: { ...row, status: 'cancelada', canCancel: false }, cancellation: { actor: 'Validador de prueba', at: row.updatedAt, reason: 'Ya no es necesario.' } };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [cancelled.summary] }); c.setQueryData(detailKey, cancelled); });
    expect(html).toContain('Solicitud cancelada'); expect(html).toContain('Ya no es necesario.'); expect(html).not.toContain('Confirmar cancelación');
  });
  it('historial muestra eventos reales sin conversación ficticia', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); }, '/?vista=mis-solicitudes&request=request-1&detailTab=history');
    expect(html).toContain('Historial de la solicitud'); expect(html).toContain('Solicitud enviada'); expect(html).toContain('Validador de prueba'); expect(html).not.toContain('Enviar mensaje');
  });
  it('creación contextual sin selector libre de destinatarios ni adjuntos inventados', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); c.setQueryData([...qualityRequestsKey, 'support-1', 'contexts', 'page=1&search=&workItemId=work-1'], { items: [{ ...row, specialist: 'Especialista de prueba' }], total: 1, page: 1, pages: 1 }); }, '/?vista=mis-solicitudes&create=1&workItemId=work-1');
    expect(html).toContain('Nueva solicitud de Calidad'); expect(html).toContain('Validación relacionada'); expect(html).toContain('Destino:'); expect(html).toContain('Ronda 2'); expect(html).toContain('V3');
    expect(html).toContain('Enviar solicitud'); expect(html).not.toContain('type="file"'); expect(html).not.toContain('Enviar a cualquier usuario');
  });
  it('sin historial muestra orientación y sin filtros no parece error', () => {
    const html = render(c => c.setQueryData(listKey, { ...list, items: [], total: 0 }), '/?vista=mis-solicitudes');
    expect(html).toContain('Aún no has enviado solicitudes.'); expect(html).toContain('Los problemas o aclaraciones que reportes durante una validación aparecerán aquí.'); expect(html).toContain('Ir a Mi trabajo');
  });
  it('loading/error de lista y de detalle son independientes y recuperables', () => {
    expect(render(() => {}, '/?vista=mis-solicitudes')).toContain('Cargando solicitudes');
    const html = render(c => { c.setQueryData(listKey, list); c.getQueryCache().build(c, { queryKey: detailKey }).setState({ status: 'error', error: Error('QA'), fetchStatus: 'idle' }); });
    expect(html).toContain('Confirmar el PDF recibido'); expect(html).toContain('Reintentar detalle');
  });
});
