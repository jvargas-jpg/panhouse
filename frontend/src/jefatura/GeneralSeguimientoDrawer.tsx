import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  fetchGeneralActividad,
  fetchGeneralDetalle,
} from './seguimientoOperativoApi';
import {
  ActividadSeguimiento,
  DatoSeguimiento,
  DrawerSeguimiento,
  ErrorSeguimiento,
  fechaSeguimiento,
} from './SeguimientoElements';
import { EstadoProyecto, PrioridadProyecto } from './PortafolioElements';
const roles: Record<string, string> = {
  especialista: 'Especialista',
  corrector: 'Corrector',
  editor: 'Editor',
  validador: 'Validador',
  disenador: 'Diseñador',
  jefe_area: 'Jefatura',
  lider_creativo: 'Líder creativo',
};
const estados: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En proceso',
  bloqueado: 'Bloqueado',
  completado: 'Completado',
  cancelado: 'Cancelado',
};
export function GeneralSeguimientoDrawer({
  id,
  onClose,
  volver,
  onCorreccion,
}: {
  id: string;
  onClose: () => void;
  volver: string;
  onCorreccion: () => void;
}) {
  const [tab, setTab] = useState('Resumen');
  const q = useQuery({
    queryKey: ['seguimiento', 'general-detalle', id],
    queryFn: () => fetchGeneralDetalle(id),
  });
  const activity = useQuery({
    queryKey: ['seguimiento', 'general-actividad', id],
    queryFn: () => fetchGeneralActividad(id),
    enabled: tab === 'Actividad',
  });
  const d = q.data,
    p = d?.proyecto;
  return (
    <DrawerSeguimiento
      title={p?.titulo ?? p?.autores ?? 'Proyecto'}
      onClose={onClose}
      footer={
        p && (
          <>
            <Link to={`/proyectos/${id}?volver=${encodeURIComponent(volver)}`}>
              Ver proyecto 360°
            </Link>
            <Link
              to={`/proyectos/${id}/ficha-trazabilidad?volver=${encodeURIComponent(volver)}`}
            >
              Ver ficha completa
            </Link>
          </>
        )
      }
    >
      {q.isLoading && <p className="js-empty">Cargando proyecto…</p>}
      {q.isError && (
        <ErrorSeguimiento error={q.error} retry={() => void q.refetch()} />
      )}
      {d && p && (
        <>
          <div className="js-drawer-context">
            <p>
              {p.autores} · #{p.codigo}
            </p>
            <div>
              <EstadoProyecto p={p} />
              <PrioridadProyecto p={p} />
            </div>
          </div>
          <div className="js-detail-tabs">
            {['Resumen', 'Procesos', 'Equipo', 'Alertas', 'Actividad'].map(
              (t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ),
            )}
          </div>
          {tab === 'Resumen' && (
            <>
              <section>
                <h3>Supervisión operativa</h3>
                <p>
                  {p.estado === 'pausado'
                    ? 'La producción está pausada.'
                    : p.estado === 'stand_by'
                      ? 'Proyecto en stand-by.'
                      : p.porAsignar
                        ? 'Proyecto entregado a Jefatura, pendiente de Especialista.'
                        : `${p.procesos.length} procesos abiertos bajo coordinación de ${p.especialista?.nombre ?? 'Producción'}.`}
                </p>
                <div className="js-data-grid">
                  <DatoSeguimiento label="Servicio">
                    {p.servicio.nombre}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Unidad">
                    {d.contexto.unidad}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Especialista">
                    {p.especialista?.nombre ?? 'Sin asignar'}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Fecha objetivo">
                    {fechaSeguimiento(p.fechaObjetivo, false)}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Ingreso comercial">
                    {d.contexto.comercial}
                  </DatoSeguimiento>
                  <DatoSeguimiento label="Ingreso RRPP">
                    {d.contexto.rrpp}
                  </DatoSeguimiento>
                </div>
              </section>
              {p.riesgo.causas.length > 0 && (
                <section className="js-alert-section">
                  <h3>Requiere atención</h3>
                  {p.riesgo.causas.map((a) => (
                    <p key={a}>{a}</p>
                  ))}
                </section>
              )}
              <button className="js-primary" onClick={onCorreccion}>
                Ver Corrección y Calidad del proyecto
              </button>
            </>
          )}
          {tab === 'Procesos' && (
            <section>
              <h3>Procesos paralelos</h3>
              {!p.procesos.length && (
                <p className="js-empty">
                  No hay procesos abiertos registrados.
                </p>
              )}
              {p.procesos.map((r) => (
                <article className="js-process-card" key={r.id}>
                  <div>
                    <strong>{r.nombre}</strong>
                    <span
                      className={`js-badge ${r.estado === 'bloqueado' ? 'js-state-bloqueado' : ''}`}
                    >
                      {estados[r.estado] ?? r.estado}
                    </span>
                  </div>
                  <p>
                    {r.responsable ?? 'Pendiente de responsable'} ·{' '}
                    {r.vence
                      ? `Vence ${fechaSeguimiento(r.vence)}`
                      : 'Sin vencimiento pautado'}
                  </p>
                  {r.vencido && (
                    <p className="js-danger">Vencimiento superado</p>
                  )}
                  {r.decisionId && <p>{r.tipo==='correccion'?'Bloqueado por decisión':'Escalación pendiente'}. <Link to={`/?vista=decisiones&decision=${r.decisionId}`}>Ver decisión</Link></p>}
                  <Link
                    to={`/proyectos/${id}/ficha-trazabilidad?volver=${encodeURIComponent(volver)}`}
                  >
                    Abrir proceso en Proyecto 360°
                  </Link>
                </article>
              ))}
            </section>
          )}
          {tab === 'Equipo' && (
            <section>
              <h3>Equipo actual</h3>
              {!d.equipo.length && (
                <p className="js-empty">Sin asignaciones registradas.</p>
              )}
              {d.equipo.map((e) => (
                <article className="js-process-card" key={e.id}>
                  <strong>{e.nombre}</strong>
                  <p>
                    {roles[e.rol] ?? 'Responsable editorial'}
                    {e.proceso ? ` · ${e.proceso}` : ''}
                  </p>
                  <small>
                    {e.asignadoEn
                      ? `Asignado ${fechaSeguimiento(e.asignadoEn)}`
                      : 'Asignación anterior al historial formal'}
                  </small>
                </article>
              ))}
            </section>
          )}
          {tab === 'Alertas' && (
            <section>
              <h3>Alertas operativas</h3>
              {p.procesos.filter(r=>r.decisionId).map(r=><p key={`decision-${r.id}`}><Link to={`/?vista=decisiones&decision=${r.decisionId}`}>Ver decisión de {r.nombre}</Link></p>)}
              {p.riesgo.causas.length ? (
                p.riesgo.causas.map((a) => (
                  <p className="js-alert-section" key={a}>
                    {a}
                  </p>
                ))
              ) : (
                <p className="js-empty">Sin alertas operativas registradas.</p>
              )}
              {p.procesos
                .filter((r) => r.estado === 'bloqueado' || r.vencido)
                .map((r) => (
                  <p key={r.id}>
                    {r.nombre}:{' '}
                    {r.estado === 'bloqueado'
                      ? 'bloqueado'
                      : 'vencimiento superado'}
                  </p>
                ))}
              {d.solicitudes.length > 0 ? (
                <>
                  <h3>Solicitudes abiertas</h3>
                  {d.solicitudes.map((s) => (
                    <article className="js-process-card" key={s.id}>
                      <strong>{s.titulo}</strong>
                      <p>{s.destino}</p>
                      <Link to={`/?vista=solicitudes&proyecto=${id}`}>
                        Revisar solicitud
                      </Link>
                    </article>
                  ))}
                </>
              ) : (
                <p className="js-empty">
                  Sin solicitudes abiertas para este proyecto.
                </p>
              )}
            </section>
          )}
          {tab === 'Actividad' &&
            (activity.isLoading ? (
              <p className="js-empty">Cargando actividad…</p>
            ) : activity.isError ? (
              <ErrorSeguimiento
                error={activity.error}
                retry={() => void activity.refetch()}
              />
            ) : (
              <ActividadSeguimiento items={activity.data?.actividad ?? []} />
            ))}
        </>
      )}
    </DrawerSeguimiento>
  );
}
