import { useQuery } from '@tanstack/react-query';
import type { ProjectCommandCenter, ProcesoProyecto } from '../../../shared/projectCommandCenter';
import { Estado, dateFicha } from './fichaViva/FichaElements';
import { CommandCenterProceso } from './CommandCenterProceso';
import { derivarLineaPrincipal, TERMINALES } from './operacionWorkflow';
import { fetchCorreccionesDeProyecto } from './correccionesApi';

// Checklist real para Preparación inicial — mismos 3 campos que ya arma
// preparacion.detalle en el backend (server/helpers/projectCommandCenter.ts),
// no datos inventados. Para el resto de los pasos no existe un desglose de
// requisitos por campo de negocio en el modelo actual (ver reporte final):
// se usa proceso.trabajos[] (cada intervención real) como checklist genérico,
// salvo Corrección (ver RequisitosCorreccion) donde sí existen campos reales.
function RequisitosPreparacion({ data }: { data: ProjectCommandCenter }) {
  const items: [string, boolean][] = [
    ['Primer contacto con el autor', !!data.preparacion.primerContactoEn],
    ['Reunión operativa realizada', data.preparacion.reunionOperativaRealizada],
    ['Espacio documental configurado', data.preparacion.driveEstado === 'configurado'],
  ];
  return <ul className="cc-requisitos-list">{items.map(([label, hecho]) => <li key={label} className={hecho ? 'cc-req-hecho' : 'cc-req-falta'}><span aria-hidden="true">{hecho ? '✓' : '○'}</span>{label}</li>)}</ul>;
}
function RequisitosTrabajos({ proceso }: { proceso: ProcesoProyecto }) {
  if (!proceso.trabajos.length) return <p className="cc-caption">Sin intervenciones registradas todavía en este paso.</p>;
  return <ul className="cc-requisitos-list">{proceso.trabajos.map(t => <li key={t.id} className={t.estado === 'completado' ? 'cc-req-hecho' : t.estado === 'bloqueado' ? 'cc-req-bloqueado' : 'cc-req-falta'}>
    <span aria-hidden="true">{t.estado === 'completado' ? '✓' : t.estado === 'bloqueado' ? '⛔' : '○'}</span>
    {t.instancia === 'default' ? proceso.nombre : t.instancia}{t.responsable && <small> · {t.responsable}</small>}
    {t.gate && <small className="cc-req-motivo"> · {t.gate}</small>}
  </li>)}</ul>;
}
// Entregables reales de Corrección (server/db/schema/correcciones.ts) —
// no genéricos: corrector asignado, inicio, documento con control de
// cambios, informe técnico, y la fecha límite real. Si la consulta falla
// o ninguna fila coincide con los work items de este paso, cae de vuelta
// al checklist genérico (RequisitosTrabajos) sin romper la pantalla.
function RequisitosCorreccion({ id, proceso }: { id: string; proceso: ProcesoProyecto }) {
  // Misma queryKey Y misma forma que SeccionCorreccionOperativa.tsx:505
  // ({correcciones: [...]}) a propósito — comparten caché real, no una
  // colisión: usar una forma distinta bajo la misma key pisaba los datos
  // del otro consumidor (bug encontrado y corregido en la propia QA).
  const q = useQuery({ queryKey: ['correcciones', id], queryFn: () => fetchCorreccionesDeProyecto(id) });
  if (q.isPending) return <p role="status">Consultando intervención de Corrección…</p>;
  const workItemIds = new Set(proceso.trabajos.map(t => t.id));
  const activas = q.isError ? [] : q.data.correcciones.filter(c => workItemIds.has(c.workItemId));
  if (!activas.length) return <RequisitosTrabajos proceso={proceso}/>;
  return <>{activas.map(c => {
    const items: [string, boolean, string?][] = [
      ['Corrector asignado', !!(c.correctorId || c.correctorNombre), c.correctorNombre ?? undefined],
      ['Corrección iniciada', !!c.fechaInicio],
      ['Documento corregido con control de cambios', !!c.controlCambiosUrl],
      ['Informe técnico de corrección', !!c.informeTecnicoUrl],
    ];
    return <ul className="cc-requisitos-list" key={c.id}>
      {items.map(([label, hecho, nota]) => <li key={label} className={hecho ? 'cc-req-hecho' : 'cc-req-falta'}><span aria-hidden="true">{hecho ? '✓' : '○'}</span>{label}{nota && <small> · {nota}</small>}</li>)}
      {c.dueAt && <li className="cc-req-deadline">Entrega pautada: {dateFicha(c.dueAt)}</li>}
    </ul>;
  })}</>;
}

function PasoActual({ id, data, paso, especialista, rrpp, inconsistencia }: { id: string; data: ProjectCommandCenter; paso: ProcesoProyecto; especialista: boolean; rrpp: boolean; inconsistencia: boolean }) {
  return <div className="cc-step cc-step-actual">
    <div className="cc-step-head"><span className="cc-step-dot cc-step-dot-actual" aria-hidden="true"/><div><span className="cc-eyebrow">ESTÁS AQUÍ</span><h2>{paso.nombre}</h2></div><Estado state={paso.estado}/></div>
    {inconsistencia && <p className="cc-step-warning" role="alert">⚠ Hay un paso anterior incompleto mientras este ya tiene trabajo registrado — revisar antes de confiar en el orden mostrado.</p>}
    <section className="cc-requisitos">
      <h3>Qué necesitas para continuar</h3>
      {paso.tipo === 'preparacion_inicial' ? <RequisitosPreparacion data={data}/> : paso.tipo === 'correccion' ? <RequisitosCorreccion id={id} proceso={paso}/> : <RequisitosTrabajos proceso={paso}/>}
      <p className={'cc-step-cta ' + (paso.action ? 'cc-cta-available' : 'cc-cta-disabled')}>
        {paso.action ? <>Disponible ahora: <strong>{paso.action.label}</strong></> : 'Sin acción disponible para tu rol en este paso.'}
      </p>
    </section>
    <div className="cc-step-panel"><CommandCenterProceso id={id} tipo={paso.tipo} especialista={especialista} rrpp={rrpp} data={data} proceso={paso}/></div>
  </div>;
}
function PasoCompletado({ paso, onOpen }: { paso: ProcesoProyecto; onOpen: () => void }) {
  return <button type="button" className="cc-step cc-step-hecho" onClick={onOpen}>
    <span className="cc-step-dot cc-step-dot-hecho" aria-hidden="true">✓</span>
    <strong>{paso.nombre}</strong>
    <span className="ph-badge ph-tone-success">Completado</span>
    <span className="cc-row-detail">{dateFicha(paso.trabajos.map(t => t.cierre).filter((d): d is string => !!d).sort().at(-1) ?? null) || ''}</span>
  </button>;
}
// Un paso ANTERIOR al actual en la secuencia pero que en realidad no está
// Completo/Cancelado — la inconsistencia real (ver derivarLineaPrincipal).
// El badge es SIEMPRE "Incompleto histórico", nunca el estado crudo del
// proceso (que podría decir "En curso" y sugerir una segunda etapa activa
// en paralelo, justo la ambigüedad que esto reemplaza) — no se muestra
// como ✓ falso ni como trabajo en paralelo, se marca distinto y se deja
// abrir para supervisión (Jefatura) o regularización (Especialista).
function PasoIncompletoPrevio({ paso, onOpen }: { paso: ProcesoProyecto; onOpen: () => void }) {
  return <button type="button" className="cc-step cc-step-alerta" onClick={onOpen}>
    <span className="cc-step-dot cc-step-dot-alerta" aria-hidden="true">!</span>
    <strong>{paso.nombre}</strong>
    <span className="ph-badge ph-tone-warning">Incompleto histórico</span>
    <span className="cc-row-detail">Quedó sin completar; el proyecto ya tiene trabajo posterior registrado</span>
  </button>;
}
function PasoFuturo({ paso }: { paso: ProcesoProyecto }) {
  return <div className="cc-step cc-step-futuro">
    <span className="cc-step-dot cc-step-dot-futuro" aria-hidden="true"/>
    <strong>{paso.nombre}</strong>
    <span className="ph-badge ph-tone-neutral">Futuro</span>
    <span className="cc-row-detail">{paso.motivoNoIniciado ?? paso.detalle}</span>
  </div>;
}

export function OperacionTimeline({ id, data, especialista, rrpp, onOpenPaso }: { id: string; data: ProjectCommandCenter; especialista: boolean; rrpp: boolean; onOpenPaso: (tipo: string) => void }) {
  const { pasos, actualIndex, inconsistencia } = derivarLineaPrincipal(data);
  if (!pasos.length) return <p className="cc-caption">Este servicio no tiene pasos de producción aplicables.</p>;
  if (actualIndex === -1) return <div className="cc-timeline">
    {pasos.map(p => <PasoCompletado key={p.tipo} paso={p} onOpen={() => onOpenPaso(p.tipo)}/>)}
    <p className="cc-caption">Todos los pasos de la línea principal están completados.</p>
  </div>;
  const completados = pasos.slice(0, actualIndex);
  const futuros = pasos.slice(actualIndex + 1);
  return <div className="cc-timeline">
    {completados.map(p => TERMINALES.includes(p.estado)
      ? <PasoCompletado key={p.tipo} paso={p} onOpen={() => onOpenPaso(p.tipo)}/>
      : <PasoIncompletoPrevio key={p.tipo} paso={p} onOpen={() => onOpenPaso(p.tipo)}/>)}
    <PasoActual id={id} data={data} paso={pasos[actualIndex]!} especialista={especialista} rrpp={rrpp} inconsistencia={!!inconsistencia}/>
    {futuros.map(p => <PasoFuturo key={p.tipo} paso={p}/>)}
  </div>;
}
