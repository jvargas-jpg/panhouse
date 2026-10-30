import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { SoporteDigitalMiTrabajo } from './SoporteDigitalMiTrabajo';
import { digitalWorkKey } from './SoporteDigitalUi';
import type { DigitalMaterialsResult, DigitalWorkDetail, DigitalWorkList, DigitalWorkRow } from '../../../shared/soporteDigitalWork';
vi.stubGlobal('React', React);

const row: DigitalWorkRow = {
  workItemId: 'work-1', projectId: 'project-1', projectTitle: 'Proyecto digital de prueba', projectCode: 'PH-001',
  authors: 'Autor de prueba', coverUrl: null, stage: 'preparation', taskLabel: 'Enviar el formulario de activación Amazon',
  deadline: null, deadlineState: null, status: 'Pendiente', blocker: null, actionable: true, packageAvailable: false,
  lastActivity: { label: 'Activación Amazon habilitada', at: '2026-10-26T12:00:00Z' },
};
const list: DigitalWorkList = { items: [row], total: 1, page: 1, pages: 1, counts: { all: 1, preparation: 1, testing: 0, loaded: 0, completed: 0 }, options: { projects: [{ id: 'project-1', name: 'Proyecto digital de prueba' }] } };
const detail: DigitalWorkDetail = {
  revision: 'a'.repeat(64), canStart: false, canEditData: true, startedAt: null,
  currentLoads: { kdp: false, kindle: false },
  summary: row, specialist: 'Especialista de prueba', assignedAt: '2026-10-20T12:00:00Z',
  cuentaAmazon: null, formSentAt: null, activatedAt: null, digitalEstatus: null, packageAvailable: false,
  nextAction: { kind: 'enviarFormulario' }, waitingOn: null,
  catalog: [{ label: 'Formulario y cuenta', fields: [{ key: 'recepcionFormulario', label: 'Recepción de formulario Amazon', type: 'fecha', value: null }] }],
  materialsAvailable: false,
  history: [{ id: 'h1', label: 'Activación Amazon habilitada', at: '2026-10-20T12:00:00Z' }],
};
const materials: DigitalMaterialsResult = { items: [{ id: 'f1', name: 'Interior.epub', url: 'https://drive.google.com/file/d/f1/view' }], nextPageToken: null };
const listKey = [...digitalWorkKey, 'lista', 'tab=all&search=&page=1&pageSize=10'];
const detailKey = [...digitalWorkKey, 'detalle', 'work-1'];
const materialsKey = [...digitalWorkKey, 'archivos', 'work-1'];

function render(seed: (c: QueryClient) => void, url = '/?vista=mi-trabajo&workItem=work-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['auth', 'me'], { id: 'digital-1', rol: 'soporte_digital', nombre: 'Soporte Digital Demo', email: 'digital@qa.test' });
  seed(client);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location={url}><SoporteDigitalMiTrabajo /></StaticRouter></QueryClientProvider>);
  client.clear(); return html;
}

describe('Soporte Digital · Mi trabajo', () => {
  it('sin cards de KPI: empieza directo en tabs + búsqueda + lista + detalle', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).not.toContain('class="sd-summary');
    expect(html).toContain('Todas');
    expect(html).toContain('En preparación');
    expect(html).toContain('Para pruebas KDP');
    expect(html).toContain('Buscar por proyecto, autor, código o tarea');
  });

  it('una fila es una tarea real (work item), con etapa y tarea separadas, sin KPIs ni progreso %', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).toContain('Proyecto digital de prueba');
    expect(html).toContain('Enviar el formulario de activación Amazon');
    expect(html).toContain('PH-001');
    expect(html).not.toMatch(/>\s*\d+\s*%\s*</);
  });

  it('vacío de la bandeja no parece un error', () => {
    const html = render(c => c.setQueryData(listKey, { ...list, items: [], total: 0, counts: { all: 0, preparation: 0, testing: 0, loaded: 0, completed: 0 } }), '/?vista=mi-trabajo');
    expect(html).toContain('No tienes tareas digitales pendientes actualmente.');
  });

  it('detalle: información real de la tarea y siguiente paso específico, no un botón genérico', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).toContain('Especialista de prueba');
    expect(html).toContain('Enviar el formulario de activación Amazon');
    expect(html).not.toContain('>Ir a la tarea<');
  });

  it('esperando el paquete final: siguiente paso explícito, no se confunde con un atraso', () => {
    const waiting: DigitalWorkRow = { ...row, actionable: false, blocker: 'Esperando la entrega del paquete final' };
    const waitingDetail: DigitalWorkDetail = { ...detail, summary: waiting, nextAction: null, waitingOn: 'Diseño/Calidad — paquete final' };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [waiting] }); c.setQueryData(detailKey, waitingDetail); });
    expect(html).toContain('Esperando la entrega del paquete final');
  });

  it('materiales: sin paquete final disponible explica la dependencia real, no un explorador de Drive vacío genérico', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); }, '/?vista=mi-trabajo&workItem=work-1&detailTab=materiales');
    expect(html).toContain('El paquete final todavía no está disponible');
  });

  it('materiales: con paquete disponible lista los archivos reales de la carpeta KDP, no todo Drive', () => {
    const d2: DigitalWorkDetail = { ...detail, materialsAvailable: true };
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, d2); c.setQueryData(materialsKey, { pages: [materials], pageParams: [undefined] }); }, '/?vista=mi-trabajo&workItem=work-1&detailTab=materiales');
    expect(html).toContain('Interior.epub');
  });

  it('Amazon/KDP: solo campos reales ya registrados en la ficha, agrupados, nunca inventados', () => {
    const d2: DigitalWorkDetail = { ...detail, catalog: [{ label: 'Pruebas y carga KDP', fields: [{ key: 'pruebaArchivos', label: 'Prueba de archivos KDP en Amazon', type: 'fecha', value: '2026-10-15' }, { key: 'cargaKdp', label: 'Carga de archivos KDP', type: 'fecha', value: null }] }] };
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, d2); }, '/?vista=mi-trabajo&workItem=work-1&detailTab=amazon');
    expect(html).toContain('Prueba de archivos KDP en Amazon');
    expect(html).toContain('Carga de archivos KDP');
    expect(html).toContain('Sin registrar');
    expect(html).not.toMatch(/royalt|ASIN|precio de venta final|contrase(ñ|n)a/i);
  });

  it('nunca expone cuenta Amazon ni credenciales en ninguna pestaña', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, { ...detail, cuentaAmazon: null }); });
    expect(html).not.toMatch(/contrase(ñ|n)a|password|2fa/i);
  });

  it('historial: eventos reales del proyecto, con su propio estado vacío', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); }, '/?vista=mi-trabajo&workItem=work-1&detailTab=historial');
    expect(html).toContain('Activación Amazon habilitada');
    const vacio = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, { ...detail, history: [] }); }, '/?vista=mi-trabajo&workItem=work-1&detailTab=historial');
    expect(vacio).toContain('Sin actividad registrada.');
  });

  it('etapa completada: sin próxima acción ni formulario, solo confirmación', () => {
    const done: DigitalWorkRow = { ...row, stage: 'completed', actionable: false, blocker: 'Control digital completado; revisar el cierre de esta tarea' };
    const doneDetail: DigitalWorkDetail = { ...detail, summary: done, nextAction: null, digitalEstatus: 'Completado' };
    const html = render(c => { c.setQueryData(listKey, { ...list, items: [done] }); c.setQueryData(detailKey, doneDetail); });
    expect(html).toContain('Digital completado');
    expect(html).not.toContain('Registrar');
  });

  it('ofrece volver a toda la bandeja desde el detalle', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).toContain('Ver todo mi trabajo');
  });

  it('no incluye gráficos ni botones globales fuera de alcance', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    expect(html).not.toMatch(/<svg[^>]*class="[^"]*chart/i);
    expect(html).not.toContain('>Publicar<');
    expect(html).not.toContain('>Reportar problema<');
  });

  it('ofrece estado, etapa, vencimiento, bloqueo y orden sin perder la unidad tarea', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, detail); });
    for (const label of ['Estado', 'Etapa', 'Fecha límite', 'Bloqueo', 'Ordenar tareas']) expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('Tarea actual');
    expect(html).not.toContain('Etapa / Tarea');
  });

  it('iniciar es una acción explícita con fecha real, independiente de abrir la fila', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, { ...detail, canStart: true }); });
    expect(html).toContain('Iniciar tarea');
    expect(html).not.toContain('type="date"');
  });

  it('Materiales permite paginar y abrir únicamente su carpeta KDP', () => {
    const html = render(c => { c.setQueryData(listKey, list); c.setQueryData(detailKey, { ...detail, materialsAvailable: true }); c.setQueryData(materialsKey, {
      pages: [{ ...materials, nextPageToken: 'next', folderUrl: 'https://drive.google.com/drive/folders/kdp-1' }], pageParams: [undefined],
    }); }, '/?vista=mi-trabajo&workItem=work-1&detailTab=materiales');
    expect(html).toContain('Ver más archivos');
    expect(html).toContain('Abrir materiales en Drive');
    expect(html).toContain('folders/kdp-1');
  });
});
