import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ValidationInbox, ValidationReview, type ValidationDetail, type ValidationRow } from './ValidacionesPage';
import { ValidationNavigation } from './ValidationUi';
import { validationWorkIdentity } from '../../../shared/validationWork.js';
vi.stubGlobal('React', React);
const detail: ValidationDetail = { ...validationWorkIdentity('diagramacion', 1), id: 'phase', title: 'Libro QA', author: 'Elisa Vega', phase: 'Calidad · Validación Fase 1', phaseNumber: 1, round: 1, version: 'V0', dueAt: null, provider: 'Estudio X', assignmentId: 'assignment', started: false, canApprove: false, upload: null, materials: [{ label: 'Versión para revisar', role: 'current', url: '/api/validaciones/phase/archivo' }] };
function render(d: ValidationDetail) { const cache = new QueryClient(); const html = renderToStaticMarkup(<QueryClientProvider client={cache}><ValidationReview detail={d} refresh={() => {}}/></QueryClientProvider>); cache.clear(); return html; }
describe('Bandeja enfocada de Validadores', () => {
 it('V0 muestra ambas decisiones bloqueadas y sus explicaciones', () => { const html = render(detail); expect(html).toMatch(/disabled=""[^>]*>Enviar cambios para aplicar/); expect(html).toMatch(/disabled=""[^>]*>Todos los cambios fueron aplicados correctamente/); expect(html).toContain('Sube primero el archivo con tus comentarios.'); expect(html).toContain('Disponible al revisar una versión posterior'); expect(html).toContain('Se guardará como:'); expect(html).toContain('V0_F1_R1_correcciones_a_aplicar_'); expect(html).toContain('Arrastra aquí el archivo revisado'); });
 it('comentarios se habilita solo con upload confirmado, V1 permite cierre sin upload', () => { const html = render({ ...detail, version: 'V1', canApprove: true }); expect(html).toMatch(/disabled=""[^>]*>Enviar cambios para aplicar/); expect(html).toMatch(/class="vr-secondary">Todos los cambios fueron aplicados correctamente/); const uploaded = render({ ...detail, upload: { fileId: 'drive-file', name: 'V0_F1_R1_correcciones.pdf' } }); expect(uploaded).toMatch(/class="vr-primary">Enviar cambios para aplicar/); expect(uploaded).toContain('Guardado correctamente en Drive'); });
 it('la navegación ofrece una sola área operativa', () => { const html = renderToStaticMarkup(<StaticRouter location="/"><ValidationNavigation/></StaticRouter>); expect(html).toContain('Validaciones'); for (const label of ['Mi trabajo', 'Mis proyectos', 'Historial', 'Mis solicitudes', 'Soporte Editorial']) expect(html).not.toContain(label); });
 it('Revisión Final reutiliza revisión y archivos sin datos comerciales o historial', () => { const html = render({ ...detail, ...validationWorkIdentity('diagramacion', 3), phase: 'Calidad · Revisión Final', phaseNumber: 3 }); expect(html).toContain('Calidad · Revisión Final'); for (const label of ['Contrato', 'Comercial', 'Peso', 'Project 360', 'Historial', 'RRPP']) expect(html).not.toContain(label); });
 it('una sola bandeja mezcla Calidad y Soporte Editorial como contextos de trabajo', () => {
  const base: ValidationRow = { ...validationWorkIdentity('diagramacion', 1), id: 'a', title: 'Proyecto A', author: 'Autora', phase: '', round: 1, version: 'V0', dueAt: null, pages: null, provider: null, validator: 'Ana', requested: true, assigned: true, status: 'Esperando revisión del Validador' };
  const items = [base, { ...base, ...validationWorkIdentity('cubierta_extendida', 0), id: 'b', title: 'Proyecto B' }, { ...base, ...validationWorkIdentity('diagramacion', 3), id: 'c', title: 'Proyecto C' }];
  const html = renderToStaticMarkup(<ValidationInbox items={items} onSelect={() => {}}/>);
  for (const label of ['Proyecto A', 'Proyecto B', 'Proyecto C', 'Calidad · Validación Fase 1', 'Soporte Editorial · Revisión de cubierta', 'Calidad · Revisión Final']) expect(html).toContain(label);
  expect(html.match(/vr-job/g)).toHaveLength(3);
  expect(html).not.toContain('soporte_editorial');
 });
 it('cubierta usa su tipo de trabajo y no muestra una fase de Calidad', () => {
  const html = render({ ...detail, ...validationWorkIdentity('cubierta_extendida', 0), phaseNumber: 0, version: 'V1', canApprove: true });
  expect(html).toContain('Soporte Editorial · Revisión de cubierta');
  expect(html).toContain('V1_CUBIERTA_R1_');
  expect(html).not.toContain('Revisar colección');
  expect(html).not.toContain('Calidad ·');
 });
});
