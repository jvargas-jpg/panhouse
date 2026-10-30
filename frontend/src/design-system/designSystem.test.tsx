import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button, DataTable, SearchInput, StatusBadge, statusTone } from './components';
import { Dialog } from './Dialog';
import { BrandFooter, PanhouseLogo } from './Brand';
vi.stubGlobal('React', React);

describe('PanHouse · componentes compartidos', () => {
  it.each([
    ['Bloqueado', 'danger'], ['Vencida', 'danger'], ['No solvente', 'danger'], ['Sobrepago', 'danger'],
    ['Pendiente de verificación', 'warning'], ['Esperando al autor', 'warning'], ['Solvente', 'success'],
    ['Completado', 'success'], ['en_progreso', 'info'], ['en_revision', 'info'], ['Anulado', 'neutral'],
  ])('mantiene la semántica de %s entre roles', (label, tone) => expect(statusTone(label)).toBe(tone));
  it('los estados conservan su texto y no dependen solo del color', () => {
    const html = renderToStaticMarkup(<StatusBadge>Bloqueado</StatusBadge>);
    expect(html).toContain('Bloqueado'); expect(html).toContain('ph-tone-danger');
  });
  it('una acción auxiliar no envía accidentalmente un formulario', () => {
    const html = renderToStaticMarkup(<form><Button disabled>Consultar</Button><Button type="submit">Guardar</Button></form>);
    expect(html).toMatch(/type="button"[^>]*disabled/); expect(html).toContain('type="submit"');
  });
  it('el buscador conserva etiqueta accesible, valor y opción de limpiar', () => {
    const html = renderToStaticMarkup(<SearchInput value="Capítulo" placeholder="Buscar proyecto" onChange={() => {}} onClear={() => {}} />);
    expect(html).toContain('Buscar proyecto'); expect(html).toContain('value="Capítulo"'); expect(html).toContain('aria-label="Limpiar búsqueda"');
  });
  it('las tablas conservan encabezados y atributos de selección de cada dominio', () => {
    const html = renderToStaticMarkup(<DataTable aria-label="Tareas"><thead><tr><th scope="col">Proyecto</th></tr></thead><tbody><tr aria-selected><td>Proyecto real</td></tr></tbody></DataTable>);
    expect(html).toContain('scope="col"'); expect(html).toContain('aria-selected="true"'); expect(html).toContain('aria-label="Tareas"');
  });
  it('el diálogo conserva título accesible y bloquea el cierre durante una operación', () => {
    const html = renderToStaticMarkup(<Dialog title="Confirmar cambio" onClose={() => {}} busy><p>Contexto de la acción</p></Dialog>);
    expect(html).toContain('aria-label="Confirmar cambio"'); expect(html).toMatch(/aria-label="Cerrar panel"[^>]*disabled/); expect(html).toContain('Contexto de la acción');
  });
  it('usa el asset oficial y el lema nunca es un enlace', () => {
    const html = renderToStaticMarkup(<><PanhouseLogo /><BrandFooter /></>);
    expect(html).toContain('/brand/panhouse-logo.webp'); expect(html).toContain('Historias que conectan.'); expect(html).not.toContain('<a');
  });
});
