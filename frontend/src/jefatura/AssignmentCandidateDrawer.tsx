import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type {
  CapacidadJefatura,
  ProyectoJefatura,
} from '../../../shared/jefatura';
import { RrppIcon } from '../rrpp/RrppIcons';
import { asignarDesdeJefatura, decidirExpress } from './commandCenterApi';
import { ExpressBadge, fechaJefatura } from './JefaturaCards';

export function AssignmentCandidateDrawer({
  proyecto,
  equipo,
  onClose,
  onCambio,
}: {
  proyecto: ProyectoJefatura;
  equipo: CapacidadJefatura[];
  onClose: () => void;
  onCambio: (mensaje: string, cerrar?: boolean) => Promise<void>;
}) {
  const [seleccion, setSeleccion] = useState(
    proyecto.especialista?.id ?? proyecto.recomendacion?.especialistaId ?? '',
  );
  const [motivo, setMotivo] = useState('');
  const dialog = useRef<HTMLDivElement>(null);
  const antes = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    antes.current = document.activeElement as HTMLElement;
    dialog.current?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy.current) onClose();
      }
      if (event.key !== 'Tab') return;
      const focusables = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('keydown', handle);
      antes.current?.focus();
    };
  }, [onClose]);
  const asignacion = useMutation({
    mutationFn: () => asignarDesdeJefatura(proyecto.id, seleccion),
    onSuccess: () =>
      onCambio(
        'Especialista asignado. El historial y la carga están actualizados.',
        true,
      ),
  });
  const express = useMutation({
    mutationFn: (decision: 'confirmado' | 'normal') =>
      decidirExpress(proyecto.id, decision, proyecto.express, motivo),
    onSuccess: (_, decision) =>
      onCambio(
        decision === 'confirmado'
          ? 'Prioridad Express confirmada.'
          : 'Prioridad normal registrada.',
      ),
  });
  const ocupado = asignacion.isPending || express.isPending;
  busy.current = ocupado;
  const elegido = equipo.find((c) => c.id === seleccion);
  return (
    <div
      className="jf-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !ocupado) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jf-drawer-title"
        tabIndex={-1}
        ref={dialog}
        className="jf-drawer"
      >
        <header className="jf-drawer-head">
          <div>
            <p className="jf-eyebrow">DECISIÓN DE JEFATURA</p>
            <h2 id="jf-drawer-title">
              {proyecto.especialista
                ? 'Reasignar Especialista'
                : 'Asignar Especialista'}
            </h2>
          </div>
          <button
            type="button"
            className="jf-close"
            onClick={onClose}
            disabled={ocupado}
            aria-label="Cerrar comparador"
          >
            ×
          </button>
        </header>
        <div className="jf-drawer-body">
          <section className="jf-project-context">
            <div className="jf-context-title">
              <div>
                <h3>{proyecto.autores}</h3>
                <p>
                  #{proyecto.codigo} · {proyecto.servicio.nombre}
                </p>
              </div>
              <ExpressBadge express={proyecto.express} />
            </div>
            <dl className="jf-date-grid">
              <div>
                <dt>Fecha estándar</dt>
                <dd>{fechaJefatura(proyecto.express.fechaEstandar)}</dd>
              </div>
              <div>
                <dt>Fecha deseada</dt>
                <dd>{fechaJefatura(proyecto.express.fechaDeseada)}</dd>
              </div>
              <div>
                <dt>Compresión</dt>
                <dd>
                  {proyecto.express.compresionDias
                    ? `${proyecto.express.compresionDias} días`
                    : 'Sin compresión'}
                </dd>
              </div>
            </dl>
            {proyecto.express.estado === 'posible' && (
              <div className="jf-express-review">
                <p>
                  La fecha deseada adelanta el plazo estándar. Revisa la
                  prioridad antes de distribuir el trabajo.
                </p>
                <label className="jf-field">
                  Contexto de la decisión (opcional)
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    maxLength={500}
                    rows={2}
                  />
                </label>
                <div className="jf-actions">
                  <button
                    className="jf-button"
                    type="button"
                    onClick={() => express.mutate('confirmado')}
                    disabled={ocupado}
                  >
                    Confirmar Express
                  </button>
                  <button
                    className="jf-button jf-button-secondary"
                    type="button"
                    onClick={() => express.mutate('normal')}
                    disabled={ocupado}
                  >
                    Mantener prioridad normal
                  </button>
                </div>
              </div>
            )}
            {proyecto.express.motivo && (
              <p className="jf-context-note">
                Decisión: {proyecto.express.motivo}
              </p>
            )}
          </section>
          <div className="jf-section-heading">
            <div>
              <h3>Compara al equipo</h3>
              <p>La carga ponderada considera la composición de servicios.</p>
            </div>
            <span>{equipo.length} especialistas</span>
          </div>
          <fieldset className="jf-candidates">
            <legend className="sr-only">Elige Especialista responsable</legend>
            {equipo.map((c) => {
              const recomendado =
                proyecto.recomendacion?.especialistaId === c.id;
              return (
                <label
                  key={c.id}
                  className={`jf-candidate ${seleccion === c.id ? 'jf-candidate-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="especialista"
                    value={c.id}
                    checked={seleccion === c.id}
                    onChange={() => setSeleccion(c.id)}
                    disabled={ocupado}
                  />
                  <div className="jf-avatar">
                    {c.nombre
                      .split(' ')
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="jf-candidate-info">
                    <div className="jf-candidate-name">
                      <strong>{c.nombre}</strong>
                      {recomendado && (
                        <span className="jf-recommended">Recomendado</span>
                      )}
                      {proyecto.especialista?.id === c.id && (
                        <span className="jf-meta">Actual</span>
                      )}
                    </div>
                    <div className="jf-candidate-stats">
                      <span>
                        <b>{c.carga}</b> puntos ponderados
                      </span>
                      <span>
                        <b>{c.activos}</b> activos
                      </span>
                      <span>
                        <b>{c.express}</b> Express
                      </span>
                      <span className={c.enRiesgo ? 'jf-text-danger' : ''}>
                        <b>{c.enRiesgo}</b> en riesgo
                      </span>
                    </div>
                    <p className="jf-composition">
                      {c.servicios.length
                        ? c.servicios
                            .map(
                              (s) =>
                                `${s.cantidad} ${s.codigo} · ${s.carga} pt`,
                            )
                            .join(' / ')
                        : 'Sin proyectos activos asignados'}
                    </p>
                    {recomendado && (
                      <ul className="jf-reasons">
                        {proyecto.recomendacion!.razones.map((r) => (
                          <li key={r}>
                            <RrppIcon
                              nombre="check"
                              className="h-3.5 w-3.5 shrink-0"
                            />
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </label>
              );
            })}
          </fieldset>
          {!equipo.length && (
            <p className="jf-empty">
              No hay Especialistas activos disponibles para asignación.
            </p>
          )}
          {(asignacion.isError || express.isError) && (
            <div role="alert" className="jf-error">
              {(asignacion.error ?? express.error)?.message}
            </div>
          )}
        </div>
        <footer className="jf-drawer-footer">
          <p>
            {elegido ? (
              <>
                Seleccionado: <strong>{elegido.nombre}</strong>
              </>
            ) : (
              'Selecciona un Especialista para continuar.'
            )}
          </p>
          <div className="jf-actions">
            <button
              className="jf-button jf-button-secondary"
              type="button"
              onClick={onClose}
              disabled={ocupado}
            >
              Cancelar
            </button>
            <button
              className="jf-button"
              type="button"
              disabled={
                !elegido || ocupado || proyecto.especialista?.id === seleccion
              }
              onClick={() => asignacion.mutate()}
            >
              {asignacion.isPending
                ? 'Asignando…'
                : proyecto.especialista
                  ? 'Confirmar reasignación'
                  : 'Asignar Especialista'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
