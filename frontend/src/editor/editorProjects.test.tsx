import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EditorMisProyectos } from './EditorMisProyectos';
import type { EditorProjectDetail, EditorProjectList, EditorProjectRow, EditorProjectWork } from '../../../shared/editorProjects';
vi.stubGlobal('React', React);
const work: EditorProjectWork = { id: 'work-1', label: 'Capítulo 6', type: 'Edición de capítulo', state: 'En edición', startedAt: '2026-10-20', dueDate: '2026-10-23', deliveredAt: null, waitingOn: null, overdue: false, actionable: true, historical: false };
const project: EditorProjectRow = { projectId: 'project-1', code: 'QA-PORTAFOLIO', title: 'Proyecto editorial de prueba', authors: 'Autor QA', coverUrl: null, service: 'Escritura fantasma', serviceId: 'service-1', serviceCode: 'EF', subtype: null,
  editorialState: 'En edición', stateLabel: 'En edición', participation: 'active', assignedAt: '2026-10-01T12:00:00Z', endedAt: null, risk: false, overdue: false, blocker: null, responsibleNow: 'editor',
  interventionSummary: '2 completadas · 1 en curso', interventionCount: 3, workCounts: { known: 3, active: 1, pending: 0, waiting: 0, blocked: 0, completed: 2 }, progress: null, currentWork: work, currentIntervention: work.label,
  editor: 'Editor QA', editorId: 'editor-1', multipleEditors: false, editorCount: 1, specialist: 'Especialista QA', specialistId: 'specialist-1', nextDelivery: { label: work.label, date: work.dueDate! }, lastActivity: { label: 'Feedback del autor registrado', at: '2026-10-22T12:00:00Z' } };
const list: EditorProjectList = { items: [project], total: 1, page: 1, pages: 1, options: { states: ['En edición'], services: [{ id: 'service-1', name: 'Escritura fantasma' }], editors: [], specialists: [] } };
const detail: EditorProjectDetail = { summary: project, nextStep: 'Continúa Capítulo 6 en Mi trabajo.', interventions: [work], interventionsTotal: 1, drive: { rootUrl: null, links: [] }, materialUnavailable: false, blockers: [], deliveries: [], feedback: [], history: [] };
function render({ data = list, selected = detail, url = '/?vista=mis-proyectos', key = 'search=&page=1&pageSize=25&sort=priority', error = false, pending = false }: { data?: EditorProjectList; selected?: EditorProjectDetail; url?: string; key?: string; error?: boolean; pending?: boolean } = {}) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  if (!pending) cache.setQueryData(['editor', 'mis-proyectos', key], data);
  if (error) cache.getQueryCache().build(cache, { queryKey: ['editor', 'mi-proyecto-detalle', 'project-1'] }).setState({ status: 'error', fetchStatus: 'idle', error: new Error('QA detail failure') });
  else cache.setQueryData(['editor', 'mi-proyecto-detalle', 'project-1'], selected);
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location={url}><EditorMisProyectos /></StaticRouter></QueryClientProvider>);
  cache.clear(); return html;
}
describe('Editor · Mis proyectos · interfaz personal', () => {
  it('lista densa, sin KPI, grid, toggle o progreso falso; conserva identidad y conteos', () => {
    const html = render(); expect(html).toContain('mp-project-table'); expect(html).toContain('QA-PORTAFOLIO'); expect(html).toContain('2 completadas · 1 en curso');
    expect(html).not.toContain('eo-kpis'); expect(html).not.toContain('eo-project-grid'); expect(html).not.toContain('Tarjetas'); expect(html).not.toMatch(/\d+%|role="progressbar"/);
    expect(html).not.toContain('Limpiar filtros'); expect(html).toContain('Sin portada registrada');
  });
  it('el detalle contiene cinco secciones y contexto real, sin descripción inventada', () => {
    const html = render(); for (const tab of ['Resumen', 'Intervenciones', 'Material', 'Entregas', 'Feedback']) expect(html).toContain(tab);
    expect(html).toContain('Especialista QA'); expect(html).toContain('Tu asignación'); expect(html).toContain('Tu próxima entrega'); expect(html).not.toContain('Descripción del proyecto');
  });
  it('las intervenciones enlazan al work item correcto y no duplican la operación', () => {
    const html = render({ url: '/?vista=mis-proyectos&detailTab=interventions' });
    expect(html).toContain('vista=mi-trabajo&amp;project=project-1&amp;workItem=work-1');
    for (const text of ['Registrar entrega', 'Reportar bloqueo', 'Iniciar trabajo', 'Registrar avance', 'Reasignar Editor']) expect(html).not.toContain(text);
  });
  it('Intervenciones muestra todas las conocidas, sin truncarlas a diez', () => {
    const interventions = Array.from({ length: 12 }, (_, n) => ({ ...work, id: 'work-' + (n + 1), label: 'Capítulo ' + (n + 1) }));
    expect(render({ selected: { ...detail, interventions, interventionsTotal: 12 }, url: '/?vista=mis-proyectos&detailTab=interventions' })).toContain('Capítulo 12');
  });
  it('vacíos de material, entregas y feedback son honestos y no ofrecen Drive roto', () => {
    expect(render({ url: '/?vista=mis-proyectos&detailTab=material' })).toContain('Este proyecto aún no tiene espacio documental de Edición disponible.');
    expect(render({ url: '/?vista=mis-proyectos&detailTab=deliveries' })).toContain('Aún no has registrado entregas en este proyecto.');
    expect(render({ url: '/?vista=mis-proyectos&detailTab=feedback' })).toContain('No hay feedback registrado en este proyecto.');
    expect(render()).not.toContain('Ver en Drive');
  });
  it('material usa exactamente el enlace persistido y feedback pendiente remite a Mi trabajo', () => {
    const url = 'https://drive.google.com/drive/folders/persisted-legacy-folder';
    const material = render({ selected: { ...detail, drive: { rootUrl: url, links: [{ key: 'EDITING', label: 'Carpeta de Edición', url }] } }, url: '/?vista=mis-proyectos&detailTab=material' });
    expect(material).toContain('href="' + url + '"'); expect(material).toContain('Ver en Drive');
    const feedback = render({ selected: { ...detail, feedback: [{ id: 'feedback-1', workItemId: work.id, interventionLabel: work.label, label: 'Feedback del autor registrado', actor: 'Especialista QA', at: '2026-10-23T12:00:00Z', pending: true, kind: 'received' }] }, url: '/?vista=mis-proyectos&detailTab=feedback' });
    expect(feedback).toContain('Pendiente de aplicar'); expect(feedback).toContain('Aplicar en Mi trabajo');
  });
  it('histórico no ofrece operación ni interpreta el trabajo actual de otro editor', () => {
    const prior = { ...project, participation: 'history' as const, stateLabel: 'Participación finalizada', currentWork: null, currentIntervention: null, nextDelivery: null };
    const html = render({ data: { ...list, items: [prior] }, selected: { ...detail, summary: prior, interventions: [{ ...work, historical: true, actionable: false }], nextStep: 'Tu participación finalizó.' } });
    expect(html).toContain('Participación finalizada'); expect(html).not.toContain('href="/?vista=mi-trabajo'); expect(html).not.toContain('Ver en Drive');
  });
  it('espera muestra al tercero y su SLA en pausa', () => {
    const waiting = { ...work, state: 'Esperando autor' as const, waitingOn: 'author' as const, actionable: false, overdue: false, dueDate: null };
    const p = { ...project, stateLabel: 'Esperando autor', editorialState: 'Esperando autor' as const, currentWork: waiting, nextDelivery: null, overdue: false };
    const html = render({ data: { ...list, items: [p] }, selected: { ...detail, summary: p, interventions: [waiting], nextStep: 'Esperando feedback del autor.' } });
    expect(html).toContain('Esperando feedback del autor.'); expect(html).toContain('SLA en pausa'); expect(html).not.toContain('Con entrega vencida');
  });
  it('loading, vacío filtrado y error de detalle se recuperan sin perder la lista', () => {
    expect(render({ pending: true })).toContain('Cargando proyectos editoriales');
    const empty = render({ data: { ...list, items: [], total: 0 }, url: '/?vista=mis-proyectos&search=nada', key: 'search=nada&page=1&pageSize=25&sort=priority' });
    expect(empty).toContain('No hay proyectos que coincidan con estos filtros.'); expect(empty).toContain('Limpiar filtros');
    const error = render({ error: true }); expect(error).toContain('No se pudo cargar el proyecto.'); expect(error).toContain('Reintentar proyecto'); expect(error).toContain('Proyecto editorial de prueba');
  });
});
