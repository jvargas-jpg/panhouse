import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { RrppProyectoDetalle } from './RrppProyectoDetalle';
import type { ResumenProyectoConsulta } from './rrppProyectosApi';
vi.stubGlobal('React', React);

function baseStage(key: string, label: string, overrides: Partial<ResumenProyectoConsulta['stages'][number]> = {}) {
  return { key, label, estado: 'pendiente', registrado: null, progress: null, responsables: [], rol: 'rrpp', dueAt: null, ultimaActividad: null, instancias: 0, activas: 0, bloqueadas: 0, ...overrides };
}

function baseProyecto(overrides: Partial<ResumenProyectoConsulta> = {}): ResumenProyectoConsulta {
  return {
    id: 'project-1', codigo: 'QA-001', nombre: 'Autora de prueba', autorPrincipal: 'Autora de prueba',
    estado: 'en_proceso', contextoRrpp: 'ingreso', contextoEtiqueta: 'En ingreso', actualizadoAt: null,
    servicio: { id: 'servicio-1', codigo: 'SE', nombre: 'Sello editorial' },
    subtipoCrudo: null, responsableActual: 'Sin trabajo abierto registrado', areasActuales: [],
    stages: [
      baseStage('ingreso', 'Ingreso RRPP'), baseStage('jefatura', 'Jefatura'), baseStage('creativa', 'Creativa'),
      baseStage('edicion', 'Edición'), baseStage('correccion', 'Corrección'), baseStage('diseno', 'Diseño'),
      baseStage('calidad', 'Calidad'), baseStage('lanzamiento', 'Lanzamiento'),
    ],
    produccionHito: null,
    informacion: { autorPrincipal: 'Autora de prueba', coautores: [], titulo: null, subtitulo: null, coleccion: null, tema: null, publico: null, posibleTitulo: null },
    contexto: null, diagnostico: null, preparacion: null, abrirIngreso: false,
    fechas: { ingreso: null, proyectada: null, deseadaAutor: null, lanzamiento: null, ultimaActividad: null },
    eventos: [],
    creativa: { liderCreativo: [], intervenciones: [], propuestas: [], revision: [] },
    lanzamiento: null,
    ...overrides,
  };
}

function render(proyecto: ResumenProyectoConsulta, tab?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity } } });
  client.setQueryData(['rrpp', 'proyecto-resumen', proyecto.id], proyecto);
  const params = new URLSearchParams(tab ? { tab } : {});
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><StaticRouter location="/">
    <RrppProyectoDetalle id={proyecto.id} params={params} setParams={(() => {}) as never} />
  </StaticRouter></QueryClientProvider>);
  client.clear();
  return html;
}

describe('RRPP · Proyectos · detalle', () => {
  it('ya no muestra Producción como pestaña y reemplaza Creativa por Conceptos de portada', () => {
    const html = render(baseProyecto());
    expect(html).not.toContain('id="tab-produccion"');
    expect(html).not.toContain('id="tab-creativa"');
    expect(html).toContain('id="tab-conceptos"');
    expect(html).toContain('Conceptos de portada');
  });

  it('Resumen colapsa Edición/Corrección/Diseño/Calidad en un solo hito derivado, sin barras de progreso por etapa', () => {
    const html = render(baseProyecto({ produccionHito: 'Actualmente en Diseño' }));
    expect(html).toContain('Actualmente en Diseño');
    expect(html).not.toMatch(/role="progressbar"[^>]*aria-label="Completitud de ingreso RRPP"[^>]*>[\s\S]{0,400}Diseño/);
  });

  it('sin trabajo de producción activo ni pendiente no inventa un hito', () => {
    const html = render(baseProyecto({ produccionHito: null }));
    expect(html).toContain('Progreso por etapa');
    expect(html).not.toContain('Actualmente en');
  });

  it('Conceptos de portada muestra Líder Creativo, título/subtítulo y estado del brief, no controles de edición del Líder Creativo', () => {
    const html = render(
      baseProyecto({
        informacion: { autorPrincipal: 'Autora de prueba', coautores: [], titulo: 'El título definitivo', subtitulo: 'El subtítulo definitivo', coleccion: null, tema: null, publico: null, posibleTitulo: null },
        creativa: {
          liderCreativo: ['Líder Creativo de prueba'],
          intervenciones: [{ id: 'dc-1', tipo: 'concepto_portada', fechaReunion: '2026-01-10', reunionRealizada: true, fechaBriefEnviadoAutor: '2026-01-12', fechaBriefAprobadoAutor: null, fechaCierre: null, resultado: null, estado: 'en_progreso' }],
          propuestas: [{ id: 'pr-1', direccionId: 'dc-1', descripcion: 'Concepto real', enlace: 'https://example.test/concepto', estado: null, fechaRrpp: null, fechaAutor: null, fecha: '2026-01-13T00:00:00Z' }],
          revision: [{ direccionId: 'dc-1', propuestas: [{ id: 'pr-1', descripcion: 'Concepto real', enlace: 'https://example.test/concepto' }] }],
        },
      }),
      'conceptos',
    );
    expect(html).toContain('Líder Creativo de prueba');
    expect(html).toContain('El título definitivo');
    expect(html).toContain('El subtítulo definitivo');
    expect(html).toContain('Realizada');
    expect(html).toContain('Revisar conceptos');
    expect(html).toContain('1 pendiente(s)');
    expect(html).not.toContain('Registrar reunión');
    expect(html).not.toContain('Editar brief');
  });

  it('muestra el badge de conceptos pendientes junto a la pestaña cuando hay revisión abierta', () => {
    const html = render(
      baseProyecto({
        creativa: {
          liderCreativo: [],
          intervenciones: [],
          propuestas: [{ id: 'pr-1', direccionId: 'dc-1', descripcion: 'x', enlace: null, estado: null, fechaRrpp: null, fechaAutor: null, fecha: '2026-01-13T00:00:00Z' }],
          revision: [{ direccionId: 'dc-1', propuestas: [{ id: 'pr-1', descripcion: 'x', enlace: null }] }],
        },
      }),
    );
    expect(html).toMatch(/Conceptos de portada[\s\S]{0,300}>\s*1\s*</);
  });

  it('sin intervención creativa activa explica que Dirección Creativa aún no se activó, sin ocultar la pestaña', () => {
    const html = render(baseProyecto(), 'conceptos');
    expect(html).toContain('Conceptos de portada');
    expect(html).toContain('todavía no se ha activado');
  });
});
