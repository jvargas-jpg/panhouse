import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ProyectoJefatura } from '../../../shared/jefatura';
import { RrppIcon } from '../rrpp/RrppIcons';
import {
  asignarDesdeJefatura,
  decidirExpress,
  fetchComparacionAsignacion,
} from './commandCenterApi';
import { ErrorJefatura, ExpressBadge, fechaJefatura } from './JefaturaCards';

export function AssignmentCandidateDrawer({
  proyecto: inicial,
  onClose,
  onCambio,
  modoInicial = 'contexto',
}: {
  proyecto: ProyectoJefatura;
  onClose: () => void;
  onCambio: (mensaje: string, cerrar?: boolean) => Promise<void>;
  modoInicial?: 'contexto' | 'candidatos';
}) {
  const location = useLocation();
  const retorno = location.pathname + location.search;
  const [comparando, setComparando] = useState(modoInicial === 'candidatos');
  const candidatosRef = useRef<HTMLDivElement>(null);
  const comparacion = useQuery({
    queryKey: ['jefatura', 'candidatos', inicial.id],
    queryFn: () => fetchComparacionAsignacion(inicial.id),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const proyecto = comparacion.data?.proyecto ?? inicial;
  const contexto = comparacion.data?.contexto;
  const equipo = comparacion.isError
    ? []
    : (comparacion.data?.candidatos ?? []);
  const sinDatos =
    !comparacion.data || comparacion.isError || comparacion.isFetching;
  const [confirmando, setConfirmando] = useState(false);
  const [seleccion, setSeleccion] = useState(
    proyecto.recomendacion?.especialistaId ?? proyecto.especialista?.id ?? '',
  );
  const [motivo, setMotivo] = useState('');
  useEffect(() => {
    if (!seleccion && comparacion.data)
      setSeleccion(
        comparacion.data.proyecto.recomendacion?.especialistaId ??
          comparacion.data.proyecto.especialista?.id ??
          '',
      );
  }, [comparacion.data, seleccion]);
  useEffect(() => { if (comparando && comparacion.data) candidatosRef.current?.scrollIntoView({ block: 'start' }); }, [comparando, comparacion.data]);
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
    mutationFn: () =>
      asignarDesdeJefatura(
        proyecto.id,
        seleccion,
        proyecto.especialista?.id ?? null,
      ),
    onSuccess: () =>
      onCambio(
        'Asignación registrada. El historial y la carga están actualizados.',
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
  const recomendado = sinDatos ? undefined : equipo.find(c => c.recomendado);
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
        className={`jf-drawer ${comparando ? 'jf-drawer-comparison' : 'jf-drawer-decision'}`}
      >
        <header className="jf-drawer-head">
          <div>
            <p className="jf-eyebrow">DECISIÓN DE JEFATURA</p>
            <h2 id="jf-drawer-title">{comparando ? 'Comparar especialistas' : proyecto.especialista ? 'Reasignar Especialista' : 'Asignar Especialista'}</h2>
          </div>
          <button
            type="button"
            className="jf-close"
            onClick={onClose}
            disabled={ocupado}
            aria-label="Cerrar panel de decisión"
          >
            ×
          </button>
        </header>
        <div className="jf-drawer-body">
          <section className="jf-project-context">
            <div className="jf-context-title">
              <div>
                <h3>{proyecto.titulo || proyecto.autores}</h3>
                <p>
                  #{proyecto.codigo} · {proyecto.autores}
                </p>
              </div>
              <ExpressBadge express={proyecto.express} />
            </div>
            <p className="jf-context-note">
              Asignación actual:{' '}
              <strong>{proyecto.especialista?.nombre ?? 'Sin asignar'}</strong>{' '}
              · Impacto del proyecto:{' '}
              <strong>
                +{proyecto.impactoCarga} punto
                {proyecto.impactoCarga === 1 ? '' : 's'}
              </strong>
            </p>
            <p className="jf-context-note">
              {proyecto.especialista ? 'Asignado' : 'Pendiente de asignación'} · {proyecto.servicio.codigo === 'CR' ? `CR — ${proyecto.servicio.nombre}` : proyecto.servicio.nombre}
            </p>
            <h4 className="jf-decision-label">Contexto para asignar</h4>
            {proyecto.datoIncompleto && <p className="jf-context-note jf-text-danger">LEGACY / DATO INCOMPLETO: RRPP envió este Crudo sin clasificación. No hay plazo ni evaluación Express hasta que RRPP lo defina.</p>}
            {proyecto.riesgo.atencion && (
              <p className="jf-context-note jf-text-danger">
                Requiere atención: {proyecto.riesgo.causas.join(' · ')}
              </p>
            )}
            <dl className="jf-date-grid">
              {proyecto.express.plazoBaseDias != null && <div><dt>Plazo base</dt><dd>{proyecto.express.plazoBaseDias} días{proyecto.subtipoCrudo === 'Tripa' ? ' · provisional' : ''}</dd></div>}
              {contexto && [
                ['Subtipo Crudo', contexto.subtipoCrudo],
                ['Ejecución comercial', contexto.ejecucion === 'Express' && contexto.tiempoExpressMeses ? `Express · ${contexto.tiempoExpressMeses} meses` : contexto.ejecucion],
                ['Fecha de ingreso', contexto.ingreso ? fechaJefatura(contexto.ingreso) : null],
                ['Cierre comercial proyectado', contexto.cierreProyectado ? fechaJefatura(contexto.cierreProyectado) : null],
                ['Capítulos pactados', contexto.capitulos], ['Páginas pactadas', contexto.paginas],
                ['Presupuesto', contexto.presupuesto], ['Alianza', contexto.alianza === null ? null : contexto.alianza ? 'Sí' : 'No'], ['Unidad', contexto.unidad],
              ].filter(([, valor]) => valor !== null && valor !== '').map(([nombre, valor]) => <div key={nombre}><dt>{nombre}</dt><dd>{valor}</dd></div>)}
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
                  {proyecto.datoIncompleto ? 'Pendiente de clasificación' : proyecto.express.compresionDias
                    ? `${proyecto.express.compresionDias} días`
                    : 'Sin compresión'}
                </dd>
              </div>
            </dl>
            {contexto && <div className="jf-readiness"><span>Información comercial <b>{contexto.comercial}</b></span><span>Ingreso RRPP <b>{contexto.rrpp}</b></span></div>}
            {contexto?.ejecucion === 'Express' && proyecto.express.estado === 'normal' && <p className="jf-context-note">Comercial registró ejecución Express. La prioridad operativa se evalúa con las fechas vigentes; no hay compresión de plazo.</p>}
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
                    disabled={ocupado || sinDatos}
                  >
                    Confirmar Express
                  </button>
                  <button
                    className="jf-button jf-button-secondary"
                    type="button"
                    onClick={() => express.mutate('normal')}
                    disabled={ocupado || sinDatos}
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
          {recomendado && <section className="jf-decision-recommendation" aria-label="Especialista recomendado">
            <div className="jf-recommendation-heading"><p className="jf-decision-label">{proyecto.especialista ? 'Alternativa recomendada' : 'Especialista recomendado'}</p>{!comparando && <button type="button" className="jf-text-link" onClick={() => setComparando(true)}>Comparar equipo</button>}</div>
            <h3>{recomendado.nombre}</h3>
            <p>Carga actual <b>{recomendado.carga}</b> → después de asignar <b>{recomendado.cargaProyectada} pts</b></p>
            <p>{recomendado.activos} activos · {recomendado.express} Express · {recomendado.enRiesgo} en riesgo</p>
            <strong>¿Por qué?</strong><ul className="jf-reasons">{recomendado.razones.map(r => <li key={r}><RrppIcon nombre="check" className="h-3.5 w-3.5 shrink-0" />{r}</li>)}</ul>
          </section>}
          {!comparando && !recomendado && <button type="button" className="jf-button jf-button-secondary" onClick={() => setComparando(true)}>Comparar equipo</button>}
          <div ref={candidatosRef} className="jf-section-heading" hidden={!comparando}>
            <div>
              <h3>Compara al equipo</h3>
              <p>La carga ponderada considera la composición de servicios.</p>
            </div>
            <span>
              {comparacion.isLoading
                ? 'Consultando equipo'
                : comparacion.isError
                  ? 'Equipo no disponible'
                  : `${equipo.length} especialistas`}
            </span>
          </div>
          <fieldset className="jf-candidates" hidden={!comparando && !comparacion.isError && !comparacion.isLoading}>
            <legend className="sr-only">Elige Especialista responsable</legend>
            {comparacion.isError && (
              <ErrorJefatura
                retry={() => {
                  void comparacion.refetch();
                }}
                texto="No pudimos actualizar los candidatos. Reintenta antes de asignar."
              />
            )}
            {comparacion.isLoading && (
              <div className="jf-list-skeleton">
                <div className="jf-skeleton" />
              </div>
            )}
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
                    onChange={() => {
                      setSeleccion(c.id);
                      setConfirmando(false);
                    }}
                    disabled={ocupado || sinDatos}
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
                      <span className="jf-meta">Activo</span>
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
                        <b>{c.activos}</b>{' '}
                        {c.activos === 1 ? 'activo' : 'activos'}
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
                    <p className="jf-candidate-projection">
                      Carga actual <b>{c.carga}</b> + impacto{' '}
                      <b>{c.impactoCarga}</b> →{' '}
                      <strong>
                        {c.cargaProyectada}{' '}
                        {c.cargaProyectada === 1
                          ? 'punto proyectado'
                          : 'puntos proyectados'}
                      </strong>
                      {c.esActual && <span>· Proyecto ya incluido</span>}
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
          {!equipo.length && !comparacion.isLoading && !comparacion.isError && (
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
        {confirmando && elegido && (
          <section
            className="jf-reassign-confirmation"
            aria-label="Confirmar cambio de responsable"
          >
            <strong>
              {proyecto.especialista?.nombre} → {elegido.nombre}
            </strong>
            <p>La asignación anterior quedará registrada en el historial.</p>
          </section>
        )}
        <footer className="jf-drawer-footer">
          <nav className="jf-decision-links" aria-label="Consulta del proyecto">
            <Link to={`/proyectos/${proyecto.id}?volver=${encodeURIComponent(retorno)}`}>Ver proyecto</Link>
            <Link to={`/proyectos/${proyecto.id}/ficha-trazabilidad?volver=${encodeURIComponent(retorno)}`}>Ver ficha de trazabilidad</Link>
          </nav>
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
              onClick={() => (confirmando ? setConfirmando(false) : onClose())}
              disabled={ocupado}
            >
              {confirmando ? 'Volver a comparar' : 'Cancelar'}
            </button>
            <button
              className="jf-button"
              type="button"
              disabled={
                !elegido ||
                ocupado ||
                sinDatos ||
                !proyecto.entregadoJefatura ||
                proyecto.especialista?.id === seleccion
              }
              onClick={() => {
                if (proyecto.especialista && !confirmando) setConfirmando(true);
                else asignacion.mutate();
              }}
            >
              {asignacion.isPending
                ? 'Asignando…'
                : proyecto.especialista
                  ? confirmando
                    ? 'Confirmar reasignación'
                    : 'Reasignar proyecto'
                  : elegido ? `Asignar a ${elegido.nombre}` : 'Seleccionar Especialista'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
