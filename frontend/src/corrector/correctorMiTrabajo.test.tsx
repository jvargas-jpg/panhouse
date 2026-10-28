import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { CorrectorMiTrabajo } from './CorrectorMiTrabajo';
import type { CorrectorWorkDetail, CorrectorWorkList, CorrectorWorkRow } from '../../../shared/correctorWork';
vi.stubGlobal('React', React);

const row: CorrectorWorkRow = {
  id: 'work-1', correctionId: 'correction-1', projectId: 'project-1', projectCode: 'QA-COR',
  title: 'Proyecto editorial de prueba', authors: 'Autor de prueba', coverUrl: null,
  intervention: 'Tripa completa', scope: 'tripa_completa', status: 'en_correccion', statusLabel: 'En corrección',
  deadline: '2026-10-30T12:00:00Z', deadlineState: 'proximo_a_vencer', blocker: null,
  lastActivity: { label: 'Corrección iniciada', at: '2026-10-26T12:00:00Z' }, completedAt: null,
  actionable: true, cta: 'Continuar',
};
const list: CorrectorWorkList = { items: [row], total: 1, page: 1, pages: 1, counts: { active: 1, completed: 0, all: 1 }, options: { projects: [{ id: 'project-1', name: 'Proyecto editorial de prueba' }] } };
const detail: CorrectorWorkDetail = {
  summary: row, assignedAt: '2026-10-20T12:00:00Z', specialist: 'Especialista de prueba',
  folders: [{ key: 'CORRECTION_INPUT', label: 'Para corregir', driveUrl: 'https://drive.google.com/drive/folders/input' }],
  materialUnavailable: false, slaLabel: '120 horas continuas desde la asignación',
  deliveries: [], blocker: null,
  history: [{ id: 'h1', label: 'Corrector asignado', actor: 'Especialista de prueba', at: '2026-10-20T12:00:00Z' }],
};

function render(node: React.ReactElement, seed: (c: QueryClient) => void, url = '/?vista=mi-trabajo&workItem=work-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['auth', 'me'], { id: 'corrector-1', rol: 'corrector', nombre: 'Corrector de prueba', email: 'corrector@qa.test' });
  seed(client);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}>{node}</StaticRouter></QueryClientProvider>);
  client.clear(); return html;
}

describe('Corrector · Mi trabajo', () => {
  it('una fila es una corrección real, sin KPIs ni columna de progreso', () => {
    const html = render(<CorrectorMiTrabajo />, c => {
      c.setQueryData(['corrector', 'mi-trabajo', 'lista', 'tab=active&search=&page=1&pageSize=10'], list);
      c.setQueryData(['corrector', 'mi-trabajo', 'detalle', 'work-1'], detail);
    });
    expect(html).toContain('Proyecto editorial de prueba');
    expect(html).toContain('Tripa completa');
    expect(html).toContain('Activas');
    expect(html).not.toContain('class="ec-kpi');
    expect(html).not.toMatch(/>\s*\d+\s*%\s*</);
  });

  it('vacío de activas no parece un error', () => {
    const html = render(<CorrectorMiTrabajo />, c => c.setQueryData(['corrector', 'mi-trabajo', 'lista', 'tab=active&search=&page=1&pageSize=10'], { ...list, items: [], total: 0, counts: { active: 0, completed: 0, all: 0 } }), '/?vista=mi-trabajo');
    expect(html).toContain('No tienes correcciones activas actualmente.');
  });

  it('el detalle muestra especialista, SLA real y exige los dos archivos antes de habilitar la entrega', () => {
    const html = render(<CorrectorMiTrabajo />, c => {
      c.setQueryData(['corrector', 'mi-trabajo', 'lista', 'tab=active&search=&page=1&pageSize=10'], list);
      c.setQueryData(['corrector', 'mi-trabajo', 'detalle', 'work-1'], detail);
    });
    expect(html).toContain('Especialista de prueba');
    expect(html).toContain('120 horas continuas');
    expect(html).toContain('Registrar entrega');
    expect(html).not.toContain('Capítulo');
  });

  it('bloqueada muestra el motivo real y no ofrece registrar entrega', () => {
    const blocked: CorrectorWorkRow = { ...row, status: 'bloqueada', statusLabel: 'Bloqueada', blocker: 'Falta el documento de entrada', actionable: false, cta: 'Ver bloqueo' };
    const blockedDetail: CorrectorWorkDetail = { ...detail, summary: blocked, blocker: { id: 'b1', reason: 'Falta el documento de entrada', createdAt: '2026-10-25T12:00:00Z', resolvedAt: null, resolution: null } };
    const html = render(<CorrectorMiTrabajo />, c => {
      c.setQueryData(['corrector', 'mi-trabajo', 'lista', 'tab=active&search=&page=1&pageSize=10'], { ...list, items: [blocked] });
      c.setQueryData(['corrector', 'mi-trabajo', 'detalle', 'work-1'], blockedDetail);
    });
    expect(html).toContain('Falta el documento de entrada');
    expect(html).not.toContain('>Registrar entrega<');
  });

  it('completada queda fuera de accionable y es de solo lectura', () => {
    const done: CorrectorWorkRow = { ...row, status: 'completada', statusLabel: 'Completada', actionable: false, cta: 'Ver entrega', completedAt: '2026-10-25T12:00:00Z' };
    const doneDetail: CorrectorWorkDetail = { ...detail, summary: done, deliveries: [{ id: 'd1', tripaDriveUrl: 'https://drive.google.com/file/d/tripa-1/view', reportDriveUrl: 'https://drive.google.com/file/d/informe-1/view', observaciones: null, submittedAt: '2026-10-25T12:00:00Z' }] };
    const html = render(<CorrectorMiTrabajo />, c => {
      c.setQueryData(['corrector', 'mi-trabajo', 'lista', 'tab=active&search=&page=1&pageSize=10'], { ...list, items: [done] });
      c.setQueryData(['corrector', 'mi-trabajo', 'detalle', 'work-1'], doneDetail);
    });
    expect(html).toContain('>Completada<');
    expect(html).toContain('consultar tu entrega y su historial');
    expect(html).not.toContain('>Registrar entrega<');
    expect(html).not.toContain('Reportar problema');
  });
});
