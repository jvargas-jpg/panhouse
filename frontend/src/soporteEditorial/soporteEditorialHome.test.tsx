import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { SoporteEditorialHomePage } from './SoporteEditorialHomePage';
import type { SoporteEditorialDashboard, ValidationItem } from '../../../shared/soporteEditorialHome';
vi.stubGlobal('React', React);
const item: ValidationItem = { faseId: 'fase-1', workItemId: 'work-1', projectId: 'project-1', code: 'QA-SE', title: 'Proyecto editorial de prueba', authors: 'Autor de prueba', coverUrl: null, numeroFase: 1, ronda: 1, validationType: 'Validación de textos diagramados', state: 'new', stateLabel: 'Nueva ronda', deadline: '2026-10-28T10:30:00Z', deadlineState: 'proximo_a_vencer', actionable: true, cta: 'Abrir validación', requestedAt: '2026-10-26T10:00:00Z', startedAt: null };
const dashboard: SoporteEditorialDashboard = { today: '2026-10-27', summary: { active: 1, dueSoon: 1, overdue: 0, newRounds: 1 }, attentionItems: [item], upcomingDeadlines: [item], recentActivity: [{ id: 'fase-1', label: 'Nueva ronda disponible', projectTitle: item.title, at: item.requestedAt }] };
function render({ data = dashboard, error = false, pending = false }: { data?: SoporteEditorialDashboard; error?: boolean; pending?: boolean } = {}) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  cache.setQueryData(['auth', 'me'], { id: 'soporte-1', rol: 'soporte_editorial', nombre: 'Valentina Cruz', email: 'soporte@qa.test' });
  if (!pending) cache.setQueryData(['soporte-editorial', 'inicio'], data);
  if (error) cache.getQueryCache().build(cache, { queryKey: ['soporte-editorial', 'inicio'] }).setState({ status: 'error', error: Error('QA error'), fetchStatus: 'idle' });
  const html = renderToStaticMarkup(<QueryClientProvider client={cache}><StaticRouter location="/"><SoporteEditorialHomePage /></StaticRouter></QueryClientProvider>); cache.clear(); return html;
}
describe('Soporte Editorial · Inicio · interfaz', () => {
  it('usa shell PanHouse, logo oficial, título real y navegación sin botones muertos', () => { const h = render(); expect(h).toContain('/brand/panhouse-logo.webp'); expect(h).toContain('Navegación de Soporte Editorial'); expect(h).toContain('Historias que conectan.'); expect(h).toContain('>Inicio<'); expect(h).toContain('Hola, Valentina Cruz'); expect(h).toContain('>Mi trabajo<'); expect(h).toContain('>Mis solicitudes<'); });
  it('cuatro indicadores reales, bandeja compartida explícita, sin KPI falsos', () => { const h = render(); for (const label of ['Validaciones activas', 'Vencen pronto', 'Vencidas', 'Nuevas rondas', 'Bandeja compartida de Calidad']) expect(h).toContain(label); expect((h.match(/class="se-summary-card /g) || []).length).toBe(4); expect(h).not.toMatch(/>\s*\d+\s*%/); expect(h).not.toContain('Score'); });
  it('una fila es una fase/ronda con su tipo de validación real, nunca un proyecto', () => { const h = render(); expect(h).toContain('Validación de textos diagramados'); expect(h).toContain('F1.1'); expect(h).toContain('Autor de prueba'); expect(h).toContain('Abrir validación'); expect(h).not.toContain('Revisión de cubierta'); });
  it('CTA deep-linkea a la sección de Calidad del proyecto real, no a Mi trabajo ni al Command Center', () => {
    const h = render();
    expect(h).toContain('/proyectos/project-1#calidad');
    expect(h).not.toContain('proceso=calidad');
    const workLinks = [...h.matchAll(/<a class="se-work-link"[^>]*href="([^"]+)"/g)].map(m => m[1]);
    expect(workLinks.length).toBeGreaterThan(0);
    for (const href of workLinks) { expect(href).not.toContain('vista=mi-trabajo'); expect(href).toBe('/proyectos/project-1#calidad'); }
  });
  it('estado vacío distingue cero activas de activas sin urgencia, sin tabla vacía', () => { const sinActivas = render({ data: { ...dashboard, summary: { active: 0, dueSoon: 0, overdue: 0, newRounds: 0 }, attentionItems: [], upcomingDeadlines: [], recentActivity: [] } }); expect(sinActivas).toContain('No hay validaciones activas en la bandeja de Calidad.'); expect(sinActivas).not.toContain('class="se-table"'); const sinUrgencia = render({ data: { ...dashboard, attentionItems: [] } }); expect(sinUrgencia).toContain('No hay validaciones que requieran atención inmediata.'); });
  it('vencida y vence pronto usan semántica textual real del backend', () => { const h = render(); expect(h).toContain('Vence pronto'); const vencida = render({ data: { ...dashboard, attentionItems: [{ ...item, deadlineState: 'vencido' }] } }); expect(vencida).toContain('se-overdue'); expect(vencida).toContain('>Vencida<'); });
  it('nueva ronda sin fecha límite no inventa una fecha', () => { const h = render({ data: { ...dashboard, attentionItems: [{ ...item, deadline: null, deadlineState: null }] } }); expect(h).toContain('Sin fecha límite'); });
  it('actividad reciente viene de eventos reales, no de Corrector ni de otro dominio', () => { const h = render(); expect(h).toContain('Nueva ronda disponible'); expect(h).toContain('Proyecto editorial de prueba'); const sinActividad = render({ data: { ...dashboard, recentActivity: [] } }); expect(sinActividad).toContain('Todavía no hay actividad reciente registrada.'); });
  it('próximos vencimientos enlaza a la validación real y la ausencia no rompe el resto', () => { expect(render()).toContain('Próximos vencimientos'); const h = render({ data: { ...dashboard, upcomingDeadlines: [] } }); expect(h).toContain('No tienes próximos vencimientos registrados.'); expect(h).toContain('Proyecto editorial de prueba'); });
  it('recordatorio operativo es breve y no un manual completo', () => { const h = render(); expect(h).toContain('Revisa siempre el PDF diagramado comparándolo con la tripa fuente'); expect(h.match(/se-reminder/g)?.length).toBeGreaterThan(0); });
  it('loading y error permiten recuperar el dashboard sin spinner de pantalla completa', () => { expect(render({ pending: true })).toContain('Cargando la bandeja de Calidad'); const h = render({ error: true }); expect(h).toContain('No se pudo cargar tu Inicio'); expect(h).toContain('Reintentar'); expect(h).toContain('/brand/panhouse-logo.webp'); });
});
