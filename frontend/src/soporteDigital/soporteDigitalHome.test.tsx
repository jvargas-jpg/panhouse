import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { SoporteDigitalHomePage, digitalHomeKey } from './SoporteDigitalHomePage';
import type { DigitalPriorityTask, DigitalSupportDashboard } from '../../../shared/soporteDigitalHome';
vi.stubGlobal('React', React);

const task: DigitalPriorityTask = { workItemId: 'work-1', projectId: 'project-1', projectTitle: 'Proyecto digital de prueba', projectCode: 'PH-001', authors: 'Autor de prueba', coverUrl: null, stage: 'preparation', taskType: 'activacion_amazon', taskLabel: 'Enviar el formulario de activación Amazon', deadline: '2026-10-28', deadlineState: 'soon', status: 'Pendiente', blocker: null, actionable: true, packageAvailable: false, href: '/?vista=mi-trabajo&workItem=work-1' };
const summary = { preparation: 1, testing: 0, loaded: 0, completed: 0 };
const dashboard: DigitalSupportDashboard = {
  today: '2026-10-28', summary, priorityTasks: [task],
  flowSummary: { counts: summary, activeTasks: 1, waitingPackage: 0, pausedProjects: 0 },
  recentActivity: { items: [{ id: 'log-1', label: 'Activación Amazon habilitada', projectTitle: task.projectTitle, at: '2026-10-27T15:00:00Z', actor: 'Equipo PanHouse', href: '/?vista=mi-trabajo&project=project-1' }], unavailable: false },
};
function render({ data = dashboard, error = false, pending = false }: { data?: DigitalSupportDashboard; error?: boolean; pending?: boolean } = {}) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  cache.setQueryData(['auth', 'me'], { id: 'soporte-1', rol: 'soporte_digital', nombre: 'Valentina Cruz', email: 'digital@qa.test' });
  if (!pending) cache.setQueryData([...digitalHomeKey, 'soporte-1'], data);
  if (error) cache.getQueryCache().build(cache, { queryKey: [...digitalHomeKey, 'soporte-1'] }).setState({ status: 'error', error: Error('QA error'), fetchStatus: 'idle' });
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location="/"><SoporteDigitalHomePage /></StaticRouter></QueryClientProvider>); cache.clear(); return html;
}

describe('Soporte Digital · Inicio · interfaz', () => {
  it('usa shell PanHouse, logo oficial, título real y navegación sin módulos fuera de alcance', () => {
    const h = render();
    expect(h).toContain('/brand/panhouse-logo.webp');
    expect(h).toContain('Navegación de Soporte Digital');
    expect(h).toContain('Historias que conectan.');
    expect(h).toContain('>Inicio<');
    expect(h).toContain('Hola, Valentina Cruz');
    expect(h).toContain('>Mi trabajo<');
    expect(h).toContain('>Mis solicitudes<');
    expect(h).toContain('href="/?vista=mis-solicitudes"');
  });

  it('cuatro indicadores reales de etapas digitales, sin KPIs ni ventas inventadas', () => {
    const h = render();
    for (const label of ['En preparación', 'Para pruebas KDP', 'Cargas registradas', 'Digital completado']) expect(h).toContain(label);
    expect((h.match(/class="sd-summary-card /g) || []).length).toBe(4);
    expect(h).not.toMatch(/ventas?|royalt|ranking|rese(ñ|n)as?|ASIN/i);
    expect(h).not.toMatch(/>\s*\d+\s*%/);
  });

  it('una fila de tareas prioritarias es una tarea real, no un proyecto genérico', () => {
    const h = render();
    expect(h).toContain('Enviar el formulario de activación Amazon');
    expect(h).toContain('Proyecto digital de prueba');
    expect(h).toContain('Abrir tarea');
    expect(h).toContain('/?vista=mi-trabajo&amp;workItem=work-1');
  });

  it('no inventa integración con Amazon ni credenciales', () => {
    const h = render();
    expect(h).not.toMatch(/sincronizado con amazon|password|contrase(ñ|n)a|token/i);
  });

  it('no incluye gráficos ni botón global de publicar', () => {
    const h = render();
    expect(h).not.toMatch(/<svg[^>]*class="[^"]*chart/i);
    expect(h).not.toContain('>Publicar<');
    expect(h).not.toContain('>Reintentar Amazon<');
  });

  it('estado vacío distingue cero tareas de una bandeja con trabajo, sin tabla vacía', () => {
    const vacio = render({ data: { ...dashboard, summary: { preparation: 0, testing: 0, loaded: 0, completed: 0 }, priorityTasks: [], flowSummary: { counts: { preparation: 0, testing: 0, loaded: 0, completed: 0 }, activeTasks: 0, waitingPackage: 0, pausedProjects: 0 } } });
    expect(vacio).toContain('No tienes tareas digitales pendientes actualmente.');
    expect(vacio).not.toContain('class="sd-tasks"');
  });

  it('proyecto esperando paquete final se distingue de un atraso real', () => {
    const esperando: DigitalPriorityTask = { ...task, actionable: false, deadlineState: null, blocker: 'Esperando la entrega del paquete final', status: 'En espera' };
    const h = render({ data: { ...dashboard, priorityTasks: [esperando], flowSummary: { ...dashboard.flowSummary, waitingPackage: 1 } } });
    expect(h).toContain('Esperando la entrega del paquete final');
    expect(h).toContain('proyecto espera');
    expect(h).not.toContain('Requiere atención');
  });

  it('bloqueado por solvencia no expone montos ni datos financieros', () => {
    const bloqueado: DigitalPriorityTask = { ...task, actionable: false, blocker: 'Bloqueado por solvencia', status: 'En espera' };
    const h = render({ data: { ...dashboard, priorityTasks: [bloqueado] } });
    expect(h).toContain('Bloqueado por solvencia');
    expect(h).not.toMatch(/\$|saldo|factura/);
  });

  it('actividad reciente usa eventos reales del dominio y su propio estado vacío', () => {
    const h = render();
    expect(h).toContain('Activación Amazon habilitada');
    const sinActividad = render({ data: { ...dashboard, recentActivity: { items: [], unavailable: false } } });
    expect(sinActividad).toContain('Aún no hay actividad reciente.');
  });

  it('actividad no disponible falla de forma independiente, sin tumbar el dashboard', () => {
    const h = render({ data: { ...dashboard, recentActivity: { items: [], unavailable: true } } });
    expect(h).toContain('No se pudo cargar la actividad reciente.');
    expect(h).toContain('En preparación');
  });

  it('loading y error permiten recuperar el dashboard sin spinner de pantalla completa', () => {
    expect(render({ pending: true })).toContain('Cargando Inicio de Soporte Digital');
    const h = render({ error: true });
    expect(h).toContain('No se pudo cargar tu Inicio');
    expect(h).toContain('Reintentar');
    expect(h).toContain('/brand/panhouse-logo.webp');
  });
});
