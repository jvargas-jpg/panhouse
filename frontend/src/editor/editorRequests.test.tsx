import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditorMisSolicitudes } from './EditorMisSolicitudes';
import type { EditorRequestDetail, EditorRequestList, EditorRequestSummary } from '../../../shared/editorOwn';
vi.stubGlobal('React', React);
const summary: EditorRequestSummary = { id: 'req-1', type: 'editor_apoyo', projectId: 'project-1', code: 'QA-REQUEST', title: 'Proyecto de prueba editorial', authors: 'Autor de prueba', coverUrl: null, workItemId: 'work-7', interventionLabel: 'Capítulo 7', motivo: 'Necesito un criterio sobre la estructura.', status: 'pendiente', target: 'Jefe de Edición', requestedAt: '2026-10-25T12:00:00Z', updatedAt: '2026-10-26T14:00:00Z', lastEventLabel: 'Solicitud en revisión', requestedBy: 'Editor de prueba', resolvedAt: null, outcome: null, version: 1, workAccessible: true, canRespond: true };
const list: EditorRequestList = { items: [summary], total: 1, page: 1, pages: 1, counts: { all: 51, pending: 30, returned: 12, resolved: 8, cancelled: 1 }, options: { projects: [{ id: 'project-1', name: summary.title }] } };
const detail: EditorRequestDetail = { summary, description: summary.motivo, observations: [], history: [{ id: 'event-1', label: 'Editor envió una solicitud', actor: 'Editor de prueba', at: summary.requestedAt }] };
function render({ data = list, selected = detail, url = '/?vista=mis-solicitudes', key = 'tab=all&page=1&pageSize=25', failure = '', pending = false }: { data?: EditorRequestList; selected?: EditorRequestDetail; url?: string; key?: string; failure?: string; pending?: boolean } = {}) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  const listKey = ['editor', 'mis-solicitudes', key], detailKey = ['editor', 'mi-solicitud-detalle', 'req-1'];
  if (!pending) cache.setQueryData(listKey, data);
  cache.setQueryData(detailKey, selected);
  if (failure) cache.getQueryCache().build(cache, { queryKey: failure === 'detail' ? detailKey : listKey }).setState({ status: 'error', fetchStatus: 'idle', error: Error('QA failure') });
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location={url}><EditorMisSolicitudes /></StaticRouter></QueryClientProvider>); cache.clear(); return html;
}
describe('Editor · Mis solicitudes · interfaz', () => {
  it('outbox compacta con conteos del backend y sin KPI, chat o tipos inventados', () => {
    const html = render(); expect(html).toContain('ms-table'); expect(html).toContain('(51)'); expect(html).toContain('(12)'); expect(html).toContain('Solicitud de apoyo');
    expect(html).not.toContain('eo-kpis'); for (const label of ['Conversación', 'Archivos adjuntos', 'Solicitud de material', 'Prioridad alta']) expect(html).not.toContain(label);
  });
  it('selección accesible y contexto del proyecto/intervención correctos', () => {
    const html = render(); expect(html).toContain('aria-selected="true"'); expect(html).toContain('tabindex="0"'); expect(html).toContain('Autor de prueba'); expect(html).toContain('Jefe de Edición');
    expect(html).toContain('vista=mi-trabajo&amp;project=project-1&amp;workItem=work-7'); expect(html).toContain(summary.motivo);
  });
  it('devuelta expone motivo y CTA para completar, sin edición de la solicitud original', () => {
    const html = render({ selected: { ...detail, summary: { ...summary, status: 'devuelta', returnReason: 'Indica el apartado concreto.' } } });
    expect(html).toContain('Información solicitada'); expect(html).toContain('Indica el apartado concreto.'); expect(html).toContain('Completar información'); expect(html).not.toContain('Editar solicitud');
  });
  it('resuelta expone resultado, actor y cambio de asignación sin acciones de decisión', () => {
    const html = render({ selected: { ...detail, summary: { ...summary, type: 'editor_reasignacion', status: 'resuelta', outcome: 'Reasignación atendida.', resolvedBy: 'Jefatura de prueba', resolvedAt: summary.updatedAt!, reassignment: { previousEditor: 'Editor anterior', nextEditor: 'Editor nuevo', assignedAt: summary.updatedAt! } } } });
    for (const text of ['Resultado', 'Reasignación atendida.', 'Jefatura de prueba', 'Editor nuevo']) expect(html).toContain(text);
    expect(html).not.toContain('class="eo-text-button ms-cancel"'); expect(html).not.toContain('Completar información'); expect(html).not.toContain('Aprobar reasignación');
  });
  it('histórica sigue consultable pero no ofrece operación sobre el trabajo actual', () => {
    const html = render({ selected: { ...detail, summary: { ...summary, status: 'devuelta', workAccessible: false, canRespond: false } } });
    expect(html).toContain('Tu intervención ya no está disponible'); expect(html).not.toContain('Ver en Mi trabajo'); expect(html).not.toContain('>Completar información<');
  });
  it('respuestas muestran las preguntas y respuestas persistidas, autores y fechas', () => {
    const html = render({ url: '/?vista=mis-solicitudes&detailTab=responses', selected: { ...detail, observations: [{ id: 'q1', question: '¿Qué apartado necesitas revisar?', answer: 'El apartado siete.', askedBy: 'Jefatura de prueba', answeredBy: 'Editor de prueba', at: summary.requestedAt, answeredAt: summary.updatedAt }] } });
    expect(html).toContain('Respuestas'); expect(html).toContain('¿Qué apartado necesitas revisar?'); expect(html).toContain('El apartado siete.'); expect(html).toContain('Jefatura de prueba');
  });
  it('historial contiene eventos reales y no infiere un estado al abrir el panel', () => {
    const html = render({ url: '/?vista=mis-solicitudes&detailTab=history' }); expect(html).toContain('Historial de la solicitud'); expect(html).toContain('Editor envió una solicitud'); expect(html).not.toContain('Abrió la solicitud');
  });
  it('error de detalle mantiene el listado, con reintento independiente', () => {
    const html = render({ failure: 'detail' }); expect(html).toContain('ms-table'); expect(html).toContain('Reintentar solicitud'); expect(html).toContain('No se pudo cargar la solicitud.');
  });
  it('vacío, filtro sin resultados, skeleton y error de lista tienen mensajes concretos', () => {
    const empty = { ...list, items: [], total: 0 };
    expect(render({ data: empty })).toContain('Aún no has enviado solicitudes.');
    expect(render({ data: empty, url: '/?vista=mis-solicitudes&search=ninguna', key: 'tab=all&page=1&pageSize=25&search=ninguna' })).toContain('No hay solicitudes que coincidan con estos filtros.');
    expect(render({ pending: true })).toContain('Cargando solicitudes enviadas');
    expect(render({ failure: 'list' })).toContain('Reintentar solicitudes');
  });
  it('flujo nuevo exige contexto y no muestra un destinatario editable', () => {
    const html = render({ url: '/?vista=mis-solicitudes&create=1' }); expect(html).toContain('Nueva solicitud'); expect(html).toContain('Tipo de solicitud'); expect(html).toContain('Destino:'); expect(html).not.toContain('Selecciona un destinatario');
  });
});
