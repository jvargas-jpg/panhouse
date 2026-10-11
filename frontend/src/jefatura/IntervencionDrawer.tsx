import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MATERIALES_SEGUIMIENTO,
  PROCESOS_SEGUIMIENTO,
  RESULTADOS_SEGUIMIENTO,
  type CambiosSupervision,
  type IntervencionSeguimiento,
  type OrigenIntervencion,
  type ResultadoSeguimiento,
} from '../../../shared/seguimientoOperativo';
import {
  fetchIntervencion,
  fetchIntervencionActividad,
  patchSupervision,
} from './seguimientoOperativoApi';
import {
  ActividadSeguimiento,
  DatoSeguimiento,
  DrawerSeguimiento,
  ErrorSeguimiento,
  EstadoIntervencionBadge,
  fechaSeguimiento,
  horasSeguimiento,
  SlaBadge,
} from './SeguimientoElements';

function SupervisionForm({
  d,
  onRefresh,
  onSaved,
  onEditing,
}: {
  d: IntervencionSeguimiento;
  onRefresh: () => void;
  onSaved: () => void;
  onEditing: () => void;
}) {
  const [notes, setNotes] = useState(d.observaciones ?? '');
  const [f1, setF1] = useState(d.observacionesF1 ?? '');
  const [result, setResult] = useState(d.resultadoSeguimiento ?? '');
  const [comments, setComments] = useState(
    d.cantidadComentarios?.toString() ?? '',
  );
  const [pages, setPages] = useState(d.paginas?.toString() ?? '');
  const [p80, setP80] = useState(d.pago80 === null ? '' : String(d.pago80));
  const [p20, setP20] = useState(d.pago20 === null ? '' : String(d.pago20));
  const cache = useQueryClient();
  const b: CambiosSupervision = { expectedUpdatedAt: d.updatedAt };
  if (notes !== (d.observaciones ?? '')) b.observaciones = notes.trim() || null;
  if (d.permisos.evaluacion && result !== (d.resultadoSeguimiento ?? ''))
    b.resultadoSeguimiento = (result || null) as ResultadoSeguimiento | null;
  if (d.permisos.evaluacion && f1 !== (d.observacionesF1 ?? ''))
    b.observacionesF1 = f1.trim() || null;
  if (
    d.permisos.comentarios &&
    comments !== (d.cantidadComentarios?.toString() ?? '')
  )
    b.cantidadComentarios = comments === '' ? null : Number(comments);
  if (d.permisos.paginasLegacy && pages !== (d.paginas?.toString() ?? ''))
    b.paginas = pages === '' ? null : Number(pages);
  if (
    d.permisos.pagos &&
    p80 !== '' &&
    p80 !== (d.pago80 === null ? '' : String(d.pago80))
  )
    b.pago80 = p80 === 'true';
  if (
    d.permisos.pagos &&
    p20 !== '' &&
    p20 !== (d.pago20 === null ? '' : String(d.pago20))
  )
    b.pago20 = p20 === 'true';
  const dirty = Object.keys(b).length > 1;
  const mutation = useMutation({
    mutationFn: () => patchSupervision(d.origen, d.id, b),
    onSuccess: async (next) => {
      cache.setQueryData(['seguimiento', 'detalle', d.origen, d.id], next);
      setNotes(next.observaciones ?? '');
      setF1(next.observacionesF1 ?? '');
      setResult(next.resultadoSeguimiento ?? '');
      setComments(next.cantidadComentarios?.toString() ?? '');
      setPages(next.paginas?.toString() ?? '');
      setP80(next.pago80 === null ? '' : String(next.pago80));
      setP20(next.pago20 === null ? '' : String(next.pago20));
      onSaved();
      await cache.invalidateQueries({
        queryKey: ['seguimiento', 'intervenciones'],
      });
      await cache.invalidateQueries({
        queryKey: ['seguimiento', 'actividad', d.origen, d.id],
      });
    },
  });
  return (
    <form
      className="js-supervision"
      onChange={onEditing}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <fieldset disabled={mutation.isPending}>
        <section>
          <h3>Supervisión de Jefatura</h3>
          <label>
            Notas de seguimiento
            <textarea
              aria-label="Notas de seguimiento"
              rows={3}
              maxLength={5000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Acuerdos, incidencias y próximos pasos…"
            />
          </label>
          {d.permisos.paginasLegacy && (
            <label>
              Páginas del registro anterior
              <input
                type="number"
                min={0}
                max={100000}
                value={pages}
                onChange={(e) => setPages(e.target.value)}
              />
            </label>
          )}
          {d.permisos.evaluacion ? (
            <>
              <label>
                Evaluación de seguimiento
                <select
                  aria-label="Evaluación de seguimiento"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                >
                  <option value="">A espera de evaluación</option>
                  {Object.entries(RESULTADOS_SEGUIMIENTO).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <p className="js-help">
                Evaluación posterior a la entrega. El resultado operativo
                permanece a cargo del responsable del proceso.
              </p>
              {d.faseNumero === 1 && (
                <label>
                  Observaciones de Fase de Calidad 1
                  <textarea
                    aria-label="Observaciones de Fase de Calidad 1"
                    rows={3}
                    maxLength={5000}
                    value={f1}
                    onChange={(e) => setF1(e.target.value)}
                  />
                </label>
              )}
            </>
          ) : (
            <DatoSeguimiento label="Evaluación de seguimiento">
              {d.resultadoSeguimiento
                ? RESULTADOS_SEGUIMIENTO[d.resultadoSeguimiento]
                : d.estado === 'entregado'
                  ? 'Resultado operativo a cargo del Especialista / Soporte Editorial'
                  : 'Disponible después de la entrega'}
            </DatoSeguimiento>
          )}
          {d.permisos.comentarios ? (
            <label>
              Comentarios de corrección
              <input
                type="number"
                min={0}
                max={100000}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </label>
          ) : (
            <DatoSeguimiento label="Comentarios del proceso">
              {d.cantidadComentarios ?? 'Sin registrar'}
            </DatoSeguimiento>
          )}
          {d.observacionesF1 && !d.permisos.evaluacion && (
            <DatoSeguimiento label="Observaciones de Fase 1">
              {d.observacionesF1}
            </DatoSeguimiento>
          )}
        </section>
        {d.freelance && (
          <section className="js-freelance">
            <h3>Seguimiento freelance</h3>
            <p>
              Contrato:{' '}
              <strong>
                {d.contratoConfirmado === null
                  ? 'Sin dato contractual'
                  : d.contratoConfirmado
                    ? 'Confirmado por el Especialista'
                    : 'Pendiente de confirmación'}
              </strong>
            </p>
            <div className="js-data-grid">
              {(['80', '20'] as const).map((n) => (
                <label key={n}>
                  Estado del {n}%
                  <select
                    aria-label={`Estado del ${n}%`}
                    value={n === '80' ? p80 : p20}
                    onChange={(e) =>
                      (n === '80' ? setP80 : setP20)(e.target.value)
                    }
                    disabled={!d.permisos.pagos}
                  >
                    <option value="" disabled>
                      Sin registrar
                    </option>
                    <option value="false">Pendiente</option>
                    <option value="true">Confirmado</option>
                  </select>
                </label>
              ))}
            </div>
            <p className="js-help">
              Registra la confirmación administrativa. No ejecuta pagos ni
              calcula montos.
            </p>
          </section>
        )}
        {mutation.isError && (
          <ErrorSeguimiento error={mutation.error} retry={onRefresh} />
        )}
        <div className="js-save">
          <span>
            {dirty ? 'Cambios sin guardar' : 'Datos de supervisión actuales'}
          </span>
          <button
            className="js-primary"
            type="submit"
            disabled={!dirty || mutation.isPending}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function IntervencionDrawer({
  origen,
  id,
  onClose,
  volver,
}: {
  origen: OrigenIntervencion;
  id: string;
  onClose: () => void;
  volver: string;
}) {
  const [tab, setTab] = useState('Detalle');
  const [guardado, setGuardado] = useState(false);
  const q = useQuery({
    queryKey: ['seguimiento', 'detalle', origen, id],
    queryFn: () => fetchIntervencion(origen, id),
    refetchOnWindowFocus: false,
  });
  const activity = useQuery({
    queryKey: ['seguimiento', 'actividad', origen, id],
    queryFn: () => fetchIntervencionActividad(origen, id),
    enabled: tab === 'Actividad',
    refetchOnWindowFocus: false,
  });
  const d = q.data;
  return (
    <DrawerSeguimiento
      title={d?.proyecto.titulo ?? d?.proyecto.autores ?? 'Intervención'}
      onClose={onClose}
      footer={
        d && (
          <>
            <Link
              to={`/proyectos/${d.proyecto.id}?volver=${encodeURIComponent(volver)}`}
            >
              Ver proyecto 360°
            </Link>
            <Link
              to={`/proyectos/${d.proyecto.id}/ficha-trazabilidad?volver=${encodeURIComponent(volver)}`}
            >
              Ver ficha completa
            </Link>
          </>
        )
      }
    >
      {q.isLoading && <p className="js-empty">Cargando intervención…</p>}
      {q.isError && (
        <ErrorSeguimiento error={q.error} retry={() => void q.refetch()} />
      )}
      {d && (
        <>
          <div className="js-drawer-context">
            <p>
              {d.proyecto.autores} · #{d.proyecto.codigo}
            </p>
            <div>
              <EstadoIntervencionBadge estado={d.estado} />
              <SlaBadge sla={d.sla} />
              {d.freelance && (
                <span className="js-badge js-gold">Freelance</span>
              )}
              {d.origen === 'legacy' && (
                <span className="js-badge">Registro anterior</span>
              )}
            </div>
          </div>
          <div className="js-detail-tabs">
            {['Detalle', 'Actividad'].map((t) => (
              <button
                key={t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'Actividad' ? (
            activity.isLoading ? (
              <p className="js-empty">Cargando actividad…</p>
            ) : activity.isError ? (
              <ErrorSeguimiento
                error={activity.error}
                retry={() => void activity.refetch()}
              />
            ) : (
              <ActividadSeguimiento items={activity.data?.actividad ?? []} />
            )
          ) : (
            <>
              <section>
                <h3>Contexto de la intervención</h3>
                <div className="js-data-grid">
                  <DatoSeguimiento label="Material">
                    {MATERIALES_SEGUIMIENTO[d.material]}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Proceso / ronda">
                    {PROCESOS_SEGUIMIENTO[d.proceso]} ·{' '}
                    {d.ronda === null
                      ? 'Ronda sin registro'
                      : `Ronda ${d.ronda}`}
                    {d.faseNumero ? ` · Fase ${d.faseNumero}` : ''}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Analista">
                    {d.analista?.nombre ?? 'Sin asignar'}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Especialista">
                    {d.especialista?.nombre ?? 'Sin asignar'}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Servicio">
                    {d.proyecto.servicio}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Unidad / páginas">
                    {d.proyecto.unidad ?? 'Sin unidad'} ·{' '}
                    {d.paginas ?? 'Sin páginas'}
                  </DatoSeguimiento>
                </div>
              </section>
              <section>
                <h3>Tiempos y cumplimiento</h3>
                <ol className="js-timeline">
                  {[
                    [
                      'Recibido / asignación registrada',
                      d.tiempos.recibido,
                      d.tiempos.fechaRecibido,
                    ],
                    ['Inicio', d.tiempos.iniciado, d.tiempos.fechaInicio],
                    ['Entrega', d.tiempos.entregado, d.tiempos.fechaEntrega],
                  ].map(([label, instant, date]) => (
                    <li key={label}>
                      <span />
                      <div>
                        <strong>{label}</strong>
                        <p>
                          {instant
                            ? fechaSeguimiento(instant)
                            : date
                              ? `${fechaSeguimiento(date, false)} · Hora sin registro`
                              : 'Pendiente de registro'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="js-data-grid">
                  <DatoSeguimiento label="Fecha límite">
                    {fechaSeguimiento(d.tiempos.vence)}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Plazo pautado">
                    {d.sla.horasObjetivo === null
                      ? 'Sin SLA definido'
                      : horasSeguimiento(d.sla.horasObjetivo)}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Duración efectiva">
                    {horasSeguimiento(d.tiempos.horasEfectivas)}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Pausas registradas">
                    {horasSeguimiento(d.tiempos.horasPausadas)}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Espera para iniciar">
                    {horasSeguimiento(d.tiempos.esperaHoras)}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Cumplimiento">
                    {d.sla.cumplimiento === 'en_plazo'
                      ? 'Entregado en plazo'
                      : d.sla.cumplimiento === 'fuera_plazo'
                        ? 'Entregado fuera de plazo'
                        : d.sla.estado === 'sin_sla'
                          ? 'Sin SLA definido'
                          : 'En seguimiento'}
                  </DatoSeguimiento>
                </div>
                <p className="js-help">
                  Las horas se registran al ejecutar las acciones del proceso.
                  Las pausas descuentan duración efectiva; no cambian por sí
                  solas el vencimiento.
                </p>
              </section>
              {(d.alertas.length > 0 || d.gate.requerido) && (
                <section className="js-alert-section">
                  <h3>Alertas y controles</h3>
                  {d.decisionId && <p>{d.origen==='correccion'?'Bloqueado por decisión de Jefatura.':'Escalación pendiente de Jefatura.'} <Link to={`/?vista=decisiones&decision=${d.decisionId}`}>Ver decisión</Link></p>}
                  {d.alertas.map((a) => (
                    <p key={a}>{a}</p>
                  ))}
                  {d.gate.requerido && (
                    <p>
                      Revisión previa de tripa &gt;120 páginas:{' '}
                      <strong>
                        {d.gate.confirmado ? 'Confirmada' : 'Pendiente'}
                      </strong>
                    </p>
                  )}
                </section>
              )}
              <section>
                <h3>Resultado del proceso</h3>
                <DatoSeguimiento
                  label={
                    d.origen === 'calidad'
                      ? 'Validación de Soporte Editorial'
                      : 'Resultado del Especialista'
                  }
                >
                  {d.resultadoOperativo
                    ? ({
                        aprobado: 'Aprobado',
                        requiere_ajustes: 'Requiere ajustes',
                      }[d.resultadoOperativo] ??
                      RESULTADOS_SEGUIMIENTO[
                        d.resultadoOperativo as ResultadoSeguimiento
                      ] ??
                      d.resultadoOperativo)
                    : 'A espera de evaluación'}
                </DatoSeguimiento>
                {d.observacionesOperativas && (
                  <p>{d.observacionesOperativas}</p>
                )}
                {d.listadoCorrectoresLegacy && (
                  <DatoSeguimiento label="Correctores del registro anterior">
                    {d.listadoCorrectoresLegacy}
                  </DatoSeguimiento>
                )}
              </section>
              {d.registroAnterior && (
                <section>
                  <h3>Datos del registro anterior</h3>
                  <p className="js-help">
                    Valores conservados de la matriz anterior; no sustituyen los
                    tiempos derivados ni definen un SLA.
                  </p>
                  <div className="js-data-grid">
                    {Object.entries(d.registroAnterior).map(
                      ([label, value]) => (
                        <DatoSeguimiento key={label} label={label}>
                          {value}
                        </DatoSeguimiento>
                      ),
                    )}
                  </div>
                </section>
              )}
              {guardado && (
                <p role="status" className="js-success">
                  Cambios guardados y registrados en el historial.
                </p>
              )}
              <SupervisionForm
                key={`${d.origen}:${d.id}:${d.updatedAt}`}
                d={d}
                onRefresh={() => void q.refetch()}
                onSaved={() => setGuardado(true)}
                onEditing={() => setGuardado(false)}
              />
            </>
          )}
        </>
      )}
    </DrawerSeguimiento>
  );
}
