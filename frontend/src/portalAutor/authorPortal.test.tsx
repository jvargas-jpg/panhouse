import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalCard } from './AuthorPortalViews';
import { deadlineLabel, type Approval } from './authorPortalApi';
vi.stubGlobal('React',React);
const approval:Approval={id:'qa',projectId:'project',projectTitle:'La memoria del agua',type:'muestra_diagramacion',title:'Muestra de Diagramación',instructions:'Revisa la legibilidad.',requestedAt:'2026-11-01T12:00:00Z',dueAt:'2026-11-02T12:00:00Z',status:'pending',feedback:null,decidedAt:null,previousId:null,sentBy:'Tu Especialista',external:false,overdueDays:2,documents:[{id:'document',title:'Muestra del libro',version:'V3'}]};
describe('Portal Autor: contenido orientado a decisiones',()=>{
 it('mantiene el CTA en aprobaciones vencidas e identifica versión/proyecto',()=>{const html=renderToStaticMarkup(<MemoryRouter><ApprovalCard approval={approval}/></MemoryRouter>);for(const label of ['Vencida hace 2 días','Revisar','V3','La memoria del agua','/autor/aprobaciones/qa'])expect(html).toContain(label);expect(html).not.toContain('disabled');});
 it('conserva historial consultable con estado humano e icono, sin permitir editar',()=>{const html=renderToStaticMarkup(<MemoryRouter><ApprovalCard approval={{...approval,status:'changes_requested',feedback:'Cambiar tamaño',decidedAt:'2026-11-03T12:00:00Z'}}/></MemoryRouter>);expect(html).toContain('↩ Cambios solicitados');expect(html).toContain('Ver decisión');expect(html).not.toContain('Solicitar cambios</button>');});
 it('plazo ausente no fabrica fecha ni deshabilita la decisión',()=>{expect(deadlineLabel({...approval,dueAt:null,overdueDays:0})).toBe('Sin fecha límite');});
});
