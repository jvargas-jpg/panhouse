import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { SoporteEditorialMiTrabajo } from './SoporteEditorialMiTrabajo';
import type { ValidatorWorkDetail, ValidatorWorkList, ValidatorWorkRow } from '../../../shared/soporteEditorialWork';
vi.stubGlobal('React', React);

const row: ValidatorWorkRow = {
  id: 'fase-1', workItemId: 'work-1', projectId: 'project-1', projectCode: 'QA-SE',
  title: 'Proyecto editorial de prueba', authors: 'Autor de prueba', coverUrl: null,
  numeroFase: 1, ronda: 1, versionLabel: 'V1', validationType: 'Validación de textos diagramados',
  status: 'in_review', statusLabel: 'En revisión',
  deadline: '2026-10-30T12:00:00Z', deadlineState: 'proximo_a_vencer',
  lastActivity: { label: 'Validación iniciada', at: '2026-10-26T12:00:00Z' },
  actionable: true, cta: 'Continuar validación',
};
const list: ValidatorWorkList = { items: [row], total: 1, page: 1, pages: 1, counts: { active: 1, waiting: 0, completed: 0, all: 1 }, options: { projects: [{ id: 'project-1', name: 'Proyecto editorial de prueba' }], types: [{ id: 'Validación de textos diagramados', name: 'Validación de textos diagramados' }] } };
const detail: ValidatorWorkDetail = {
  summary: row, specialist: 'Especialista de prueba', designer: 'Diseñador de prueba',
  requestedAt: '2026-10-24T12:00:00Z', startedAt: '2026-10-25T12:00:00Z', resolvedAt: null,
  materials: [{ role: 'diagrammed', label: 'PDF a validar', url: 'https://drive.google.com/pdf' }, { role: 'source', label: 'Tripa fuente', url: 'https://drive.google.com/fuente' }],
  criteria: [{ key: 'textos_diagramados', label: 'Textos diagramados', cumple: null, observaciones: '' }, { key: 'citas', label: 'Citas', cumple: null, observaciones: '' }],
  approved: null, pagesReviewed: null, commentsCount: null, commentsUrl: null,
  toVerifyChanges: null, pendingChanges: null, newChanges: null, observations: null,
  designAdjustment: null, previousRound: null,
  history: [{ id: 'h1', label: 'Ronda creada', at: '2026-10-24T12:00:00Z' }],
};
const listKey = ['soporte-editorial', 'mi-trabajo', 'lista', 'tab=active&search=&page=1&pageSize=10'];
const detailKey = ['soporte-editorial', 'mi-trabajo', 'detalle', 'fase-1'];

function render(seed: (c: QueryClient) => void, url = '/?vista=mi-trabajo&workItem=fase-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['auth', 'me'], { id: 'soporte-1', rol: 'soporte_editorial', nombre: 'Valentina Cruz', email: 'soporte@qa.test' });
  seed(client);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><SoporteEditorialMiTrabajo /></StaticRouter></QueryClientProvider>);
  client.clear(); return html;
}

describe('Soporte Editorial · Mi trabajo', () => {
  it('una fila es una ronda real (no un proyecto), con ronda y versión separadas, sin KPIs ni progreso %', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).toContain('Proyecto editorial de prueba');
    expect(html).toContain('F1.1');
    expect(html).toContain('V1');
    expect(html).toContain('Validación de textos diagramados');
    expect(html).toContain('Activas');
    expect(html).toContain('Pendientes de nueva revisión');
    expect(html).not.toContain('class="ec-kpi');
    expect(html).not.toMatch(/>\s*\d+\s*%\s*</);
    expect(html).not.toContain('Revisión de cubierta');
  });

  it('vacío de activas no parece un error', () => {
    const html = render(c => c.setQueryData(listKey, { ...list, items: [], total: 0, counts: { active: 0, waiting: 0, completed: 0, all: 0 } }), '/?vista=mi-trabajo');
    expect(html).toContain('No tienes validaciones activas actualmente.');
  });

  it('nueva ronda muestra "Iniciar validación" y no el checklist hasta iniciar', () => {
    const nueva: ValidatorWorkRow = { ...row, status: 'new_round', statusLabel: 'Nueva ronda', cta: 'Iniciar validación' };
    const nuevaDetail: ValidatorWorkDetail = { ...detail, summary: nueva, startedAt: null };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [nueva] }); c.setQueryData(detailKey, nuevaDetail); }, '/?vista=mi-trabajo&workItem=fase-1&detailTab=observaciones');
    expect(html).toContain('Iniciar validación');
    expect(html).not.toContain('Aprobar versión');
  });

  it('en revisión muestra el checklist real de Calidad y el formulario de resultado, sin categorías inventadas', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); }, '/?vista=mi-trabajo&workItem=fase-1&detailTab=observaciones');
    expect(html).toContain('Textos diagramados');
    expect(html).toContain('Citas');
    expect(html).toContain('Aprobar versión');
    expect(html).toContain('Devolver comentarios a Diseño');
    expect(html).not.toMatch(/severidad|score|porcentaje de calidad/i);
  });

  it('esperando Diseño: siguiente paso explícito y sin plazo propio (SLA pausado)', () => {
    const waiting: ValidatorWorkRow = { ...row, status: 'waiting_design', statusLabel: 'Esperando Diseño', actionable: false, deadline: null, deadlineState: null, cta: 'Ver contexto' };
    const waitingDetail: ValidatorWorkDetail = { ...detail, summary: waiting, approved: false, commentsCount: 2, observations: 'Revisar sangría y foliatura.', resolvedAt: '2026-10-27T10:00:00Z' };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [waiting] }); c.setQueryData(detailKey, waitingDetail); });
    expect(html).toContain('Esperando Diseño');
    expect(html).toContain('Esperando que Diseño entregue una nueva versión');
    expect(html).toContain('Sin fecha límite');
  });

  it('esperando Diseño: la ronda queda de solo lectura, con el resultado real ya registrado', () => {
    const waiting: ValidatorWorkRow = { ...row, status: 'waiting_design', statusLabel: 'Esperando Diseño', actionable: false, deadline: null, deadlineState: null, cta: 'Ver contexto' };
    const waitingDetail: ValidatorWorkDetail = { ...detail, summary: waiting, approved: false, commentsCount: 2, observations: 'Revisar sangría y foliatura.', resolvedAt: '2026-10-27T10:00:00Z' };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [waiting] }); c.setQueryData(detailKey, waitingDetail); }, '/?vista=mi-trabajo&workItem=fase-1&detailTab=observaciones');
    expect(html).toContain('Revisar sangría y foliatura.');
    expect(html).not.toContain('Aprobar versión');
  });

  it('completada es de solo lectura y muestra el resultado real registrado', () => {
    const done: ValidatorWorkRow = { ...row, status: 'completed', statusLabel: 'Completada', actionable: false, deadline: null, deadlineState: null, cta: 'Ver resultado' };
    const doneDetail: ValidatorWorkDetail = { ...detail, summary: done, approved: true, commentsCount: 0, resolvedAt: '2026-10-27T10:00:00Z' };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [done] }); c.setQueryData(detailKey, doneDetail); });
    expect(html).toContain('>Completada<');
    expect(html).toContain('Esta ronda fue aprobada.');
    expect(html).not.toContain('Aprobar versión');
    expect(html).not.toContain('Iniciar validación');
  });

  it('la referencia a la ronda anterior no se pierde (historial no sobrescribe la ronda previa)', () => {
    const withPrevious: ValidatorWorkDetail = { ...detail, previousRound: { id: 'fase-0', label: 'F1.0' } };
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, withPrevious); });
    expect(html).toContain('Proviene de Ronda F1.0');
  });

  it('Sin revisar y No aplica son elecciones diferentes antes de enviar el resultado', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); }, '/?vista=mi-trabajo&workItem=fase-1&detailTab=observaciones');
    expect(html).toContain('value="" selected="">Sin revisar');
    expect(html).toContain('value="na">No aplica');
    expect(html).toContain('El borrador se conserva');
  });

  it('el detalle ofrece acciones para iniciar y consultar los materiales en la misma pantalla', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).toContain('se-validation-actions');
    expect(html).toContain('Consultar materiales');
    expect(html).toContain('Continuar validación');
  });

  it('pausa y bloqueo muestran el contexto sin permitir registrar una revisión', () => {
    for (const condition of [{ paused: true }, { blockedReason: 'Falta el material autorizado.' }]) {
      const restricted = { ...row, ...condition, actionable: false };
      const html = render(c => { c.setQueryData(listKey, { ...list, items: [restricted] }); c.setQueryData(detailKey, { ...detail, summary: restricted }); }, '/?vista=mi-trabajo&workItem=fase-1&detailTab=observaciones');
      expect(html).toContain('Revisión no disponible');
      expect(html).not.toContain('Aprobar versión');
      expect(html).not.toContain('>Continuar validación');
    }
  });
});
