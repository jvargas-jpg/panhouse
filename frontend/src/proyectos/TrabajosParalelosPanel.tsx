import { Link } from 'react-router-dom';
import { Dialog } from '../design-system/Dialog';
import { Estado } from './fichaViva/FichaElements';
import type { ProcesoProyecto } from '../../../shared/projectCommandCenter';

// Texto de convergencia con la línea principal — SOLO para los tipos
// donde la condición ya está confirmada en código (ver auditoría del plan):
// direccion_creativa→GATE-05 (portada aprobada por RRPP, requisito real de
// Diseño); impresion→ctx.gate.motivo ya dice "paquete final cargado en
// Diseño"; soporte_digital→se activa en la primera fase de Calidad
// (diseno.ts, numeroFase===1 → habilitarActivacionAmazon, confirmado en la
// pasada anterior); lanzamiento/distribucion/revision_interna_cubierta no
// tienen una condición de convergencia confirmada — se omite en vez de
// inventarla.
const CONVERGENCIA: Partial<Record<string, string>> = {
  direccion_creativa: 'Debe tener una propuesta de portada aprobada por RRPP antes de que Diseño pueda diagramar la cubierta.',
  soporte_digital: 'Se activa en la primera validación de Calidad; a partir de ahí continúa de forma independiente.',
  impresion: 'Se habilita cuando Diseño registra el paquete final — no bloquea la línea principal.',
};

export function RamaParalela({ proceso, onOpen, compact = false }: { proceso: ProcesoProyecto; onOpen: () => void; compact?: boolean }) {
  return <article className={'cc-rama' + (compact ? ' cc-rama-compact' : '')}>
    <header><strong>{proceso.nombre}</strong><Estado state={proceso.estado}/></header>
    <p className="cc-row-who">{proceso.assignee || proceso.ownerLabel || 'Sin responsable'}</p>
    <p className="cc-row-detail">{proceso.detalle}</p>
    {!compact && CONVERGENCIA[proceso.tipo] && <p className="cc-rama-converge">↳ {CONVERGENCIA[proceso.tipo]}</p>}
    {proceso.action && (proceso.action.href ? <Link className="cc-row-cta" to={proceso.action.href}>{proceso.action.label} →</Link> : <button className="cc-row-cta" onClick={onOpen}>{proceso.action.label} →</button>)}
  </article>;
}

export function TrabajosParalelosPanel({ paralelos, onClose, onOpenPaso }: { paralelos: ProcesoProyecto[]; onClose: () => void; onOpenPaso: (tipo: string) => void }) {
  const aplicables = paralelos.filter(p => p.estado !== 'No aplica');
  return <Dialog title="Trabajos paralelos" subtitle="Coordinados por otro actor — no son pasos de la línea principal; aquí se indica si/cuándo vuelven a afectarla." onClose={onClose} variant="drawer" className="cc-paralelos-dialog">
    <div className="cc-paralelos-body">
      {aplicables.length ? aplicables.map(p => <RamaParalela key={p.tipo} proceso={p} onOpen={() => onOpenPaso(p.tipo)}/>) : <p className="cc-caption">Sin trabajos paralelos aplicables a este servicio.</p>}
    </div>
  </Dialog>;
}
