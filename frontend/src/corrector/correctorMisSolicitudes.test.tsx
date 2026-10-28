import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { CorrectorMisSolicitudes } from './CorrectorMisSolicitudes';
import type { CorrectorRequestDetail, CorrectorRequestList, CorrectorRequestSummary } from '../../../shared/correctorRequests';
vi.stubGlobal('React', React);

const row: CorrectorRequestSummary = {
  id: 'req-1', type: 'corrector_material', projectId: 'project-1', code: 'QA-COR', title: 'Proyecto editorial de prueba', authors: 'Autor de prueba', coverUrl: null,
  workItemId: 'work-1', interventionLabel: 'Tripa completa', motivo: 'El archivo no corresponde a la versión final',
  status: 'pendiente', target: 'Especialista', requestedAt: '2026-10-26T10:14:00Z', updatedAt: '2026-10-26T10:14:00Z', lastEventLabel: 'Solicitud enviada',
  resolvedAt: null, outcome: null, requestedBy: 'Corrector de prueba', workAccessible: true, canRespond: false, version: 1,
};
const list: CorrectorRequestList = { items: [row], total: 1, page: 1, pages: 1, counts: { pending: 1, resolved: 0, returned: 0, cancelled: 0, rejected: 0, all: 1 }, options: { projects: [{ id: 'project-1', name: 'Proyecto editorial de prueba' }] } };
const detail: CorrectorRequestDetail = { summary: row, description: 'El documento que se encuentra en la carpeta Para corregir parece ser una versión anterior.', observations: [], history: [{ id: 'h1', label: 'Solicitud enviada', actor: 'Corrector de prueba', at: '2026-10-26T10:14:00Z' }] };

function render(node: React.ReactElement, seed: (c: QueryClient) => void, url = '/?vista=mis-solicitudes&request=req-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['auth', 'me'], { id: 'corrector-1', rol: 'corrector', nombre: 'Corrector de prueba', email: 'corrector@qa.test' });
  seed(client);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}>{node}</StaticRouter></QueryClientProvider>);
  client.clear(); return html;
}

describe('Corrector · Mis solicitudes', () => {
  it('una fila es una solicitud real, sin KPIs, con destino siempre Especialista', () => {
    const html = render(<CorrectorMisSolicitudes />, c => {
      c.setQueryData(['corrector', 'mis-solicitudes', 'tab=all&page=1&pageSize=25'], list);
      c.setQueryData(['corrector', 'mis-solicitudes', 'detalle', 'req-1'], detail);
    });
    expect(html).toContain('Material incorrecto o faltante');
    expect(html).toContain('Proyecto editorial de prueba');
    expect(html).toContain('Especialista');
    expect(html).not.toContain('class="ec-kpi');
  });

  it('vacío: aún no has enviado solicitudes', () => {
    const html = render(<CorrectorMisSolicitudes />, c => c.setQueryData(['corrector', 'mis-solicitudes', 'tab=all&page=1&pageSize=25'], { ...list, items: [], total: 0, counts: { pending: 0, resolved: 0, returned: 0, cancelled: 0, rejected: 0, all: 0 } }), '/?vista=mis-solicitudes');
    expect(html).toContain('Aún no has enviado solicitudes.');
  });

  it('devuelta muestra la petición de información y habilita completar', () => {
    const returned: CorrectorRequestSummary = { ...row, status: 'devuelta', version: 2, canRespond: true, returnReason: 'Indica a qué nombre propio te refieres exactamente' };
    const returnedDetail: CorrectorRequestDetail = { ...detail, summary: returned, observations: [{ id: 'o1', question: 'Indica a qué nombre propio te refieres exactamente', answer: null, at: '2026-10-26T11:00:00Z', askedBy: 'Especialista de prueba' }] };
    const html = render(<CorrectorMisSolicitudes />, c => {
      c.setQueryData(['corrector', 'mis-solicitudes', 'tab=all&page=1&pageSize=25'], { ...list, items: [returned] });
      c.setQueryData(['corrector', 'mis-solicitudes', 'detalle', 'req-1'], returnedDetail);
    });
    expect(html).toContain('Indica a qué nombre propio te refieres exactamente');
    expect(html).toContain('Completar información');
  });

  it('resuelta es de solo lectura y muestra el resultado real', () => {
    const resolved: CorrectorRequestSummary = { ...row, status: 'resuelta', outcome: 'Confirmado: el archivo correcto ya está en la carpeta Para corregir.', resolvedBy: 'Especialista de prueba', resolvedAt: '2026-10-27T09:00:00Z' };
    const html = render(<CorrectorMisSolicitudes />, c => {
      c.setQueryData(['corrector', 'mis-solicitudes', 'tab=all&page=1&pageSize=25'], { ...list, items: [resolved] });
      c.setQueryData(['corrector', 'mis-solicitudes', 'detalle', 'req-1'], { ...detail, summary: resolved });
    });
    expect(html).toContain('Confirmado: el archivo correcto ya está en la carpeta Para corregir.');
    expect(html).not.toContain('Completar información');
    expect(html).not.toContain('Cancelar solicitud');
  });
});
